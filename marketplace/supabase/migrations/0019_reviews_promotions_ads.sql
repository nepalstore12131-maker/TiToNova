begin;
-- Reviews are submitted only by the two participants in completed work.
create table public.work_reviews (
 id uuid primary key default gen_random_uuid(),assignment_id uuid not null references public.job_assignments(id) on delete restrict,
 author_id uuid not null references public.profiles(id),recipient_id uuid not null references public.profiles(id),
 author_role text not null check(author_role in ('worker','hirer')),rating integer not null check(rating between 1 and 5),
 feedback text not null check(char_length(feedback) between 5 and 2000),hidden boolean not null default false,
 moderation_note text not null default '',created_at timestamptz not null default now(),unique(assignment_id,author_id),check(author_id<>recipient_id)
);
alter table public.work_reviews enable row level security;
revoke all on public.work_reviews from public,anon,authenticated;
grant select on public.work_reviews to authenticated;
create policy "Published reviews and private moderation" on public.work_reviews for select using(author_id=auth.uid() or recipient_id=auth.uid() or public.is_admin());
create function public.submit_work_review(p_assignment uuid,p_rating integer,p_feedback text) returns void language plpgsql security definer set search_path=public as $$
declare w public.job_assignments%rowtype;target uuid;
begin
 select * into w from public.job_assignments where id=p_assignment for share;
 if auth.uid() is null or w.id is null or w.state<>'completed' or auth.uid() not in (w.worker_id,w.employer_id) then raise exception 'Completed work participant required';end if;
 target:=case when auth.uid()=w.worker_id then w.employer_id else w.worker_id end;
 insert into public.work_reviews(assignment_id,author_id,recipient_id,author_role,rating,feedback) values(w.id,auth.uid(),target,case when auth.uid()=w.worker_id then 'worker' else 'hirer' end,p_rating,btrim(p_feedback));
 insert into public.notifications(recipient_id,kind,title,href) values(target,'review','You received feedback on completed work','/dashboard/work/'||w.id);
end;$$;
create function public.moderate_work_review(p_review uuid,p_hidden boolean,p_note text) returns void language plpgsql security definer set search_path=public as $$
begin
 if not public.is_admin() or auth.uid() is null then raise exception 'Admin required';end if;
 if char_length(btrim(coalesce(p_note,''))) not between 5 and 1000 then raise exception 'Moderation reason required';end if;
 update public.work_reviews set hidden=p_hidden,moderation_note=btrim(p_note) where id=p_review;
 if not found then raise exception 'Review unavailable';end if;
end;$$;
-- Public reads never expose private work, email, payment data, or full profile data.
create function public.rating_summary(p_recipient uuid) returns table(average_rating numeric,review_count bigint) language sql stable security definer set search_path=public as $$select round(avg(rating),1),count(*) from public.work_reviews where recipient_id=p_recipient and not hidden;$$;

create function public.public_work_reviews(p_recipient uuid) returns table(rating integer,feedback text,author_role text,created_at timestamptz) language sql stable security definer set search_path=public as $$select rating,feedback,author_role,created_at from public.work_reviews where recipient_id=p_recipient and not hidden order by created_at desc limit 20;$$;
revoke all on function public.public_work_reviews(uuid) from public;
grant execute on function public.public_work_reviews(uuid) to anon,authenticated;
create table public.promotion_plans (
 id uuid primary key default gen_random_uuid(),name text not null check(char_length(name) between 2 and 80),
 daily_price_npr integer not null default 0 check(daily_price_npr between 0 and 1000000),
 priority integer not null check(priority between 1 and 100),max_days integer not null default 30 check(max_days between 1 and 90),active boolean not null default false
);
insert into public.promotion_plans(name,priority) values('Top priority',1),('Second priority',2);
alter table public.promotion_plans enable row level security;
grant select on public.promotion_plans to authenticated;
grant insert,update on public.promotion_plans to authenticated;
create policy "Members read promotion plans" on public.promotion_plans for select to authenticated using(true);
create policy "Admins manage promotion plans" on public.promotion_plans for all to authenticated using(public.is_admin()) with check(public.is_admin());
create table public.job_promotion_requests (
 id uuid primary key default gen_random_uuid(),job_id uuid not null references public.jobs(id) on delete restrict,
 employer_id uuid not null references public.profiles(id),plan_id uuid not null references public.promotion_plans(id),
 plan_name text not null,daily_price_npr integer not null check(daily_price_npr>0),days integer not null check(days between 1 and 90),priority integer not null check(priority between 1 and 100),amount_npr integer not null,
 method text not null check(method in ('esewa','khalti','bank')),transaction_code text not null check(char_length(transaction_code) between 4 and 120),proof_path text not null unique,
 status text not null default 'pending' check(status in ('pending','approved','rejected')),review_note text not null default '',reviewed_by uuid references public.profiles(id),reviewed_at timestamptz,created_at timestamptz not null default now(),check(amount_npr=daily_price_npr*days)
);
create unique index promotion_one_pending on public.job_promotion_requests(job_id) where status='pending';
create unique index promotion_unique_transaction on public.job_promotion_requests(method,lower(btrim(transaction_code)));
alter table public.job_promotion_requests enable row level security;
grant select on public.job_promotion_requests to authenticated;
create policy "Owners and admins read promotion payments" on public.job_promotion_requests for select to authenticated using(employer_id=auth.uid() or public.is_admin());
create table public.job_promotions (
 job_id uuid primary key references public.jobs(id) on delete cascade,request_id uuid not null unique references public.job_promotion_requests(id),
 priority integer not null,starts_at timestamptz not null,ends_at timestamptz not null,enabled boolean not null default true,check(ends_at>starts_at)
);
alter table public.job_promotions enable row level security;
grant select on public.job_promotions to anon,authenticated;
create policy "Public active promotion markers" on public.job_promotions for select using(enabled and starts_at<=now() and ends_at>now() or public.is_admin() or exists(select 1 from public.jobs j where j.id=job_id and j.employer_id=auth.uid()));
-- Only a successful admin approval may write placement. Expired or unpublished
-- jobs never receive priority, even if a scheduler is delayed or unavailable.
create view public.job_discovery with(security_invoker=true) as select j.*,case when p.enabled and p.starts_at<=now() and p.ends_at>now() then p.priority else 2147483647 end as promotion_rank,case when p.enabled and p.starts_at<=now() and p.ends_at>now() then p.starts_at else null end as promotion_started_at,case when p.enabled and p.starts_at<=now() and p.ends_at>now() then p.ends_at else null end as promotion_ends_at from public.jobs j left join public.job_promotions p on p.job_id=j.id;
grant select on public.job_discovery to anon,authenticated;
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types) values('promotion-proofs','promotion-proofs',false,5242880,array['image/jpeg','image/png','image/webp','application/pdf']);
create policy "Hirers upload promotion proof" on storage.objects for insert to authenticated with check(bucket_id='promotion-proofs' and (storage.foldername(name))[1]=auth.uid()::text and public.current_account_role()='employer');
create policy "Private promotion proof reads" on storage.objects for select to authenticated using(bucket_id='promotion-proofs' and ((storage.foldername(name))[1]=auth.uid()::text or public.is_admin()));
create policy "Remove unlinked promotion upload" on storage.objects for delete to authenticated using(bucket_id='promotion-proofs' and (storage.foldername(name))[1]=auth.uid()::text and not exists(select 1 from public.job_promotion_requests where proof_path=name));
create table public.payment_transaction_claims(method text not null,transaction_code text not null,primary key(method,transaction_code));
alter table public.payment_transaction_claims enable row level security;
revoke all on public.payment_transaction_claims from public,anon,authenticated;
insert into public.payment_transaction_claims select payment_method,lower(btrim(transaction_code)) from public.employer_payment_requests on conflict do nothing;
create function public.claim_payment_transaction() returns trigger language plpgsql security definer set search_path=public as $$
begin
 insert into public.payment_transaction_claims(method,transaction_code) values(case when tg_table_name='employer_payment_requests' then to_jsonb(new)->>'payment_method' else to_jsonb(new)->>'method' end,lower(btrim(new.transaction_code)));
 return new;
end;$$;
revoke all on function public.claim_payment_transaction() from public;
create trigger premium_claim_transaction before insert on public.employer_payment_requests for each row execute function public.claim_payment_transaction();
create trigger promotion_claim_transaction before insert on public.job_promotion_requests for each row execute function public.claim_payment_transaction();
create function public.request_job_promotion(p_job uuid,p_plan uuid,p_days integer,p_daily_price integer,p_method text,p_transaction text,p_proof text) returns uuid language plpgsql security definer set search_path=public as $$
declare j public.jobs%rowtype;plan public.promotion_plans%rowtype;settings public.employer_payment_settings%rowtype;result uuid;
begin
 if auth.uid() is null or not public.has_active_employer_premium() then raise exception 'Premium hirer required';end if;
 select * into j from public.jobs where id=p_job for update;
 if j.id is null or j.employer_id<>auth.uid() or j.status<>'published' or j.archived_at is not null then raise exception 'Published job required';end if;
 if exists(select 1 from public.job_promotions where job_id=j.id and enabled and ends_at>now()) then raise exception 'Promotion already active';end if;
 select * into plan from public.promotion_plans where id=p_plan for share;
 if plan.id is null or not plan.active or plan.daily_price_npr<1 or p_daily_price is distinct from plan.daily_price_npr or p_days is null or p_days not between 1 and plan.max_days then raise exception 'Plan changed; reload before paying';end if;
 select * into settings from public.employer_payment_settings where id=1;
 if settings.id is null or not ((p_method='esewa' and coalesce(settings.esewa_account_id,'')<>'') or (p_method='khalti' and (coalesce(settings.khalti_account_id,'')<>'' or coalesce(settings.khalti_payment_url,'')<>'')) or (p_method='bank' and coalesce(settings.bank_name,'')<>'' and coalesce(settings.bank_account_number,'')<>'')) then raise exception 'Payment method unavailable';end if;
 if split_part(p_proof,'/',1)<>auth.uid()::text or not exists(select 1 from storage.objects where bucket_id='promotion-proofs' and name=p_proof) then raise exception 'Proof required';end if;
 if exists(select 1 from public.employer_payment_requests where payment_method=p_method and lower(btrim(transaction_code))=lower(btrim(p_transaction))) then raise exception 'Transaction already used';end if;
 insert into public.job_promotion_requests(job_id,employer_id,plan_id,plan_name,daily_price_npr,days,priority,amount_npr,method,transaction_code,proof_path) values(j.id,auth.uid(),plan.id,plan.name,plan.daily_price_npr,p_days,plan.priority,plan.daily_price_npr*p_days,p_method,btrim(p_transaction),p_proof) returning id into result;
 insert into public.notifications(recipient_id,kind,title,href) select id,'promotion','A job promotion payment needs review','/dashboard/promotions' from public.profiles where role='admin';
 return result;
end;$$;
create function public.review_job_promotion(p_request uuid,p_approve boolean,p_note text default '') returns void language plpgsql security definer set search_path=public as $$
declare r public.job_promotion_requests%rowtype;j public.jobs%rowtype;
begin
 if auth.uid() is null or not public.is_admin() then raise exception 'Admin required';end if;
 select * into r from public.job_promotion_requests where id=p_request;
 select * into j from public.jobs where id=r.job_id for update;
 select * into r from public.job_promotion_requests where id=p_request for update;
 if r.id is null or r.status<>'pending' or p_approve is null or char_length(coalesce(p_note,''))>1000 then raise exception 'Request unavailable';end if;
 if p_approve then
  if j.status<>'published' or j.archived_at is not null then raise exception 'Job must be published before approval';end if;
  if exists(select 1 from public.job_promotions where job_id=j.id and enabled and ends_at>now()) then raise exception 'Promotion already active';end if;
  insert into public.job_promotions(job_id,request_id,priority,starts_at,ends_at) values(j.id,r.id,r.priority,now(),now()+make_interval(days=>r.days)) on conflict(job_id) do update set request_id=excluded.request_id,priority=excluded.priority,starts_at=excluded.starts_at,ends_at=excluded.ends_at,enabled=true;
 end if;
 update public.job_promotion_requests set status=case when p_approve then 'approved' else 'rejected' end,review_note=coalesce(p_note,''),reviewed_by=auth.uid(),reviewed_at=now() where id=r.id;
 insert into public.notifications(recipient_id,kind,title,href) values(r.employer_id,'promotion',case when p_approve then 'Your paid job promotion is active' else 'Your promotion payment was not approved' end,'/dashboard/promotions');
end;$$;
create function public.stop_job_promotion(p_job uuid) returns void language plpgsql security definer set search_path=public as $$begin if not public.is_admin() then raise exception 'Admin required';end if;update public.job_promotions set enabled=false where job_id=p_job;end;$$;

create table public.sponsor_banners (
 id uuid primary key default gen_random_uuid(),advertiser text not null check(char_length(advertiser) between 2 and 100),title text not null check(char_length(title) between 2 and 140),
 image_path text not null,target_url text not null check(target_url ~ '^https://[^/[:space:]]+'),alt_text text not null check(char_length(alt_text) between 2 and 200),
 placement text not null check(placement in ('home','jobs')),sort_order integer not null default 10,active boolean not null default false,
 starts_at timestamptz not null default now(),ends_at timestamptz,created_at timestamptz not null default now(),check(ends_at is null or ends_at>starts_at)
);
alter table public.sponsor_banners enable row level security;
grant select on public.sponsor_banners to anon,authenticated;grant insert,update on public.sponsor_banners to authenticated;
create policy "Public current sponsor banners" on public.sponsor_banners for select using((active and starts_at<=now() and (ends_at is null or ends_at>now())) or public.is_admin());
create policy "Admins manage sponsor banners" on public.sponsor_banners for all to authenticated using(public.is_admin()) with check(public.is_admin());
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types) values('sponsor-banners','sponsor-banners',true,5242880,array['image/webp']);
create policy "Admins upload sponsor images" on storage.objects for insert to authenticated with check(bucket_id='sponsor-banners' and public.is_admin());
revoke all on function public.submit_work_review(uuid,integer,text),public.moderate_work_review(uuid,boolean,text),public.rating_summary(uuid),public.request_job_promotion(uuid,uuid,integer,integer,text,text,text),public.review_job_promotion(uuid,boolean,text),public.stop_job_promotion(uuid) from public;
grant execute on function public.submit_work_review(uuid,integer,text),public.moderate_work_review(uuid,boolean,text),public.request_job_promotion(uuid,uuid,integer,integer,text,text,text),public.review_job_promotion(uuid,boolean,text),public.stop_job_promotion(uuid) to authenticated;
grant execute on function public.rating_summary(uuid) to anon,authenticated;
commit;
