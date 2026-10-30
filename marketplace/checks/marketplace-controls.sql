-- Append inside the migration transaction, then roll everything back.
do $$
declare e uuid:=gen_random_uuid(); a uuid:=gen_random_uuid(); r uuid; j uuid:=gen_random_uuid(); j2 uuid:=gen_random_uuid(); w uuid:=gen_random_uuid(); app uuid:=gen_random_uuid(); assignment uuid; n integer; v integer;
begin
 perform set_config('request.jwt.claims','{"role":"service_role"}',true);
 insert into auth.users(id,email,raw_user_meta_data) values(e,e||'@controls.invalid','{"account_type":"employer"}'),(a,a||'@controls.invalid','{}'),(w,w||'@controls.invalid','{}');
 update public.profiles set role='admin' where id=a;
 update public.profiles set employer_premium_until=now()+interval '1 day' where id=e;
 perform set_config('request.jwt.claims',json_build_object('sub',e,'role','authenticated')::text,true);set local role authenticated;
 insert into public.jobs(id,employer_id,title,description,category,status) values(j,e,'Controls test job','Temporary job for transactional controls testing.','Development','pending_review');
 if not exists(select 1 from public.jobs where id=j and status='published') then raise exception 'New post did not publish';end if;
 begin perform public.save_marketplace_controls(1,true,2,true,true,24,false);raise exception 'Nonadmin settings write allowed';exception when raise_exception then if sqlerrm<>'Admin required' then raise;end if;end;
 reset role;
 insert into public.applications(id,job_id,applicant_id,cover_note) values(app,j,w,'Test application for assigned worker');
 set local role authenticated;assignment:=public.assign_job_worker(app);reset role;
 for i in 1..6 loop
  r:=gen_random_uuid();perform set_config('request.jwt.claims','{"role":"service_role"}',true);
  insert into auth.users(id,email,raw_user_meta_data) values(r,r||'@controls.invalid','{}');
  perform set_config('request.jwt.claims',json_build_object('sub',r,'role','authenticated')::text,true);set local role authenticated;
  insert into public.job_reports(job_id,reporter_id,reason,status) values(j,r,'spam','dismissed');
  if i=1 then
   begin insert into public.job_reports(job_id,reporter_id,reason) values(j,r,'spam');raise exception 'Duplicate counted';exception when unique_violation then null;end;
  end if;
  reset role;
  if i<6 and not exists(select 1 from public.jobs where id=j and status='published') then raise exception 'Hidden too early';end if;
 end loop;
 if not exists(select 1 from public.jobs where id=j and status='pending_review') then raise exception 'Sixth report did not hide assigned job';end if;
 perform set_config('request.jwt.claims','{"role":"anon"}',true);set local role anon;
 select count(*) into n from public.jobs where id=j;if n<>0 then raise exception 'Hidden job public';end if;reset role;
 perform set_config('request.jwt.claims',json_build_object('sub',w,'role','authenticated')::text,true);set local role authenticated;
 begin perform public.update_job_work(assignment,'start');raise exception 'Worker started held job';exception when raise_exception then if sqlerrm<>'This action is not available' then raise;end if;end;reset role;
 perform set_config('request.jwt.claims',json_build_object('sub',e,'role','authenticated')::text,true);set local role authenticated;
 begin update public.jobs set status='published' where id=j;raise exception 'Owner bypassed review';exception when raise_exception then if sqlerrm<>'Only an administrator can republish this job' then raise;end if;end;reset role;
 perform set_config('request.jwt.claims',json_build_object('sub',a,'role','authenticated')::text,true);set local role authenticated;
 update public.jobs set status='published' where id=j;
 if exists(select 1 from public.job_reports where job_id=j and status='open') then raise exception 'Old reports not dismissed';end if;
 reset role;perform set_config('request.jwt.claims','{"role":"service_role"}',true);r:=gen_random_uuid();insert into auth.users(id,email,raw_user_meta_data) values(r,r||'@controls.invalid','{}');
 perform set_config('request.jwt.claims',json_build_object('sub',r,'role','authenticated')::text,true);set local role authenticated;
 insert into public.job_reports(job_id,reporter_id,reason) values(j,r,'spam');reset role;
 if not exists(select 1 from public.jobs where id=j and status='published') then raise exception 'Old dismissed reports counted';end if;
 perform set_config('request.jwt.claims',json_build_object('sub',a,'role','authenticated')::text,true);set local role authenticated;
 perform public.save_marketplace_controls(1,true,3,false,true,24,false);
 begin perform public.save_marketplace_controls(1,false,6,true,true,24,false);raise exception 'Stale save accepted';exception when raise_exception then if sqlerrm<>'settings_stale' then raise;end if;end;
 begin perform public.save_marketplace_controls(2,true,3,false,false,48,false);raise exception 'Unconfirmed retention accepted';exception when raise_exception then if sqlerrm<>'cleanup_confirmation_required' then raise;end if;end;
 perform public.save_marketplace_controls(2,true,3,false,false,48,true);reset role;
 if (select count(*) from public.marketplace_control_history)<>2 then raise exception 'Audit missing';end if;
 perform set_config('request.jwt.claims',json_build_object('sub',e,'role','authenticated')::text,true);set local role authenticated;
 insert into public.jobs(id,employer_id,title,description,category,status) values(j2,e,'Review enabled test','Temporary job for transactional controls testing.','Development','published');
 if not exists(select 1 from public.jobs where id=j2 and status='pending_review') then raise exception 'Review setting ignored';end if;reset role;
 perform set_config('request.jwt.claims',json_build_object('sub',a,'role','authenticated')::text,true);set local role authenticated;
 update public.jobs set status='published' where id=j2;reset role;
 for i in 1..3 loop
  r:=gen_random_uuid();perform set_config('request.jwt.claims','{"role":"service_role"}',true);insert into auth.users(id,email,raw_user_meta_data) values(r,r||'@controls.invalid','{}');
  perform set_config('request.jwt.claims',json_build_object('sub',r,'role','authenticated')::text,true);set local role authenticated;
  insert into public.job_reports(job_id,reporter_id,reason) values(j2,r,'spam');reset role;
 end loop;
 if not exists(select 1 from public.jobs where id=j2 and status='pending_review') then raise exception 'Custom threshold ignored';end if;
 if (select count(*) from public.notifications where recipient_id=a and kind='moderation')<>1 then raise exception 'Notification toggle ignored';end if;
 perform set_config('request.jwt.claims','{"role":"service_role"}',true);
 insert into public.support_tickets(owner_id,subject,topic,status,resolved_at) values(w,'Paused cleanup test','Other','resolved',now()-interval '60 hours');
 if public.purge_resolved_support()<>0 then raise exception 'Paused cleanup deleted data';end if;
 if has_function_privilege('authenticated','public.purge_resolved_support()','EXECUTE') then raise exception 'Member may purge';end if;
end$$;
rollback;
select 'PASS: automatic publish; unique reporters; sixth-report hold; private held job; worker start blocked; owner bypass blocked; admin restores and resets reports; configurable review; stale save blocked; confirmation required; audit trail; paused cleanup; all test changes rolled back' as result;
