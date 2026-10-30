-- Run after migration in the same transaction, then ROLLBACK all fixtures/schema.
do $$
declare e uuid:=gen_random_uuid();a uuid:=gen_random_uuid();x uuid:=gen_random_uuid();plan uuid:=gen_random_uuid();req uuid:=gen_random_uuid();req2 uuid:=gen_random_uuid();rev timestamptz;art text;proof text;tx text:=gen_random_uuid()::text;bid uuid;n integer;result uuid;
begin
 perform set_config('request.jwt.claims','{"role":"service_role"}',true);
 insert into auth.users(id,email,raw_user_meta_data) values(e,e||'@adtest.invalid','{"account_type":"employer"}'),(a,a||'@adtest.invalid','{}'),(x,x||'@adtest.invalid','{}');
 update public.profiles set role='admin' where id=a;
 insert into public.advertising_plans(id,name,placement,daily_price_npr,active) values(plan,'Transactional ad test','home',100,true) returning revision into rev;
 update public.employer_payment_settings set esewa_account_id='test-only' where id=1;
 art:=e::text||'/'||req::text||'.webp';proof:=e::text||'/'||req::text||'.pdf';
 insert into storage.objects(bucket_id,name) values('advertising-artwork',art),('advertising-proofs',proof);
 perform set_config('request.jwt.claims',json_build_object('sub',e,'role','authenticated')::text,true);set local role authenticated;
 begin perform public.request_banner_ad(req,plan,rev-interval '1 second',1,'Test brand','Test headline','Wide ad image','https://example.com',art,proof,'esewa',tx);raise exception 'Stale plan accepted';exception when raise_exception then if sqlerrm<>'Plan changed; reload before paying' then raise;end if;end;
 result:=public.request_banner_ad(req,plan,rev,1,'Test brand','Test headline','Wide ad image','https://example.com',art,proof,'esewa',tx);
 if result<>req then raise exception 'Wrong request id';end if;
 if public.request_banner_ad(req,plan,rev,1,'Test brand','Test headline','Wide ad image','https://example.com',art,proof,'esewa',tx)<>req then raise exception 'Retry not idempotent';end if;
 begin perform public.review_banner_ad(req,true);raise exception 'Self approval accepted';exception when raise_exception then if sqlerrm<>'Admin required' then raise;end if;end;
 perform set_config('request.jwt.claims',json_build_object('sub',x,'role','authenticated')::text,true);
 select count(*) into n from public.advertising_requests where id=req;if n<>0 then raise exception 'Request leaked';end if;
 select count(*) into n from storage.objects where name in (art,proof);if n<>0 then raise exception 'Private uploads leaked';end if;
 reset role;perform set_config('request.jwt.claims','{"role":"anon"}',true);set local role anon;
 select count(*) into n from storage.objects where name in (art,proof);if n<>0 then raise exception 'Pending artwork publicly visible';end if;
 reset role;
 update public.advertising_plans set daily_price_npr=200,width=1200,height=300 where id=plan;
 if not exists(select 1 from public.advertising_requests where id=req and amount_npr=100 and width=1600 and height=400) then raise exception 'Quoted purchase changed';end if;
 -- Temporarily pause existing banners inside this rolled-back transaction to isolate capacity tests.
 update public.sponsor_banners set active=false;
 perform set_config('request.jwt.claims',json_build_object('sub',a,'role','authenticated')::text,true);set local role authenticated;
 perform public.review_banner_ad(req,true,'Verified payment and artwork');
 begin perform public.review_banner_ad(req,true);raise exception 'Repeated approval accepted';exception when raise_exception then if sqlerrm<>'Request unavailable' then raise;end if;end;
 select banner_id into bid from public.advertising_requests where id=req;
 if not exists(select 1 from public.sponsor_banners where id=bid and ends_at-starts_at=interval '24 hours') then raise exception 'Incorrect paid duration';end if;
 reset role;perform set_config('request.jwt.claims','{"role":"anon"}',true);set local role anon;
 select count(*) into n from storage.objects where bucket_id='advertising-artwork' and name=art;if n<>1 then raise exception 'Approved artwork not readable';end if;
 select count(*) into n from storage.objects where bucket_id='advertising-proofs' and name=proof;if n<>0 then raise exception 'Approved proof leaked';end if;
 reset role;
 update public.sponsor_banners set starts_at=now()-interval '2 days',ends_at=now()-interval '1 day' where id=bid;
 perform set_config('request.jwt.claims','{"role":"anon"}',true);set local role anon;
 select count(*) into n from public.sponsor_banners where id=bid;if n<>0 then raise exception 'Expired ad displayed';end if;
 select count(*) into n from storage.objects where bucket_id='advertising-artwork' and name=art;if n<>0 then raise exception 'Expired art still publicly readable';end if;
 reset role;
 if not exists(select 1 from public.payment_transaction_claims where method='esewa' and transaction_code=lower(tx)) then raise exception 'Transaction not reserved';end if;
 begin insert into public.payment_transaction_claims values('esewa',lower(tx));raise exception 'Transaction reusable';exception when unique_violation then null;end;
 -- Two occupied slots block a third banner without consuming purchased time.
 insert into public.sponsor_banners(advertiser,title,image_path,target_url,alt_text,placement,active,ends_at) values('Test brand','Slot one','test-one.webp','https://example.com','Test artwork','jobs',true,now()+interval '1 day'),('Test brand','Slot two','test-two.webp','https://example.com','Test artwork','jobs',true,now()+interval '1 day');
 begin insert into public.sponsor_banners(advertiser,title,image_path,target_url,alt_text,placement,active,ends_at) values('Test brand','Slot three','test-three.webp','https://example.com','Test artwork','jobs',true,now()+interval '1 day');raise exception 'Capacity overflow accepted';exception when raise_exception then if sqlerrm<>'At most two overlapping banners per placement' then raise;end if;end;
 raise notice 'PASS: quote snapshots, idempotent submit, admin-only approval, private proofs, expiry and public approved artwork';
end;$$;
rollback;
