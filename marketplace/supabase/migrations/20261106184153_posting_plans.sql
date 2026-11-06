alter table public.employer_payment_settings
  add column free_posts integer not null default 0 check (free_posts between 0 and 10000),
  add column free_period text not null default 'lifetime' check (free_period in ('lifetime','month')),
  add column single_post_npr integer not null default 0 check(single_post_npr between 0 and 100000000),
  add column premium_monthly_limit integer check(premium_monthly_limit between 1 and 10000),
  add column single_checkout_url text not null default '',
  add column premium_checkout_url text not null default '';
alter table public.employer_payment_requests
  add column product text not null default 'premium' check(product in ('premium','post')),
  drop constraint employer_payment_requests_payment_method_check,
  add check(payment_method in ('bank','esewa','khalti','international'));

-- Receipts survive deleting a job so removing a post cannot reset a quota.
create table public.job_post_receipts (
  job_id uuid primary key, employer_id uuid not null references public.profiles(id) on delete cascade,
  source text not null check(source in ('free','premium','credit')),
  created_at timestamptz not null default now()
);
create index job_post_receipts_usage on public.job_post_receipts(employer_id,source,created_at);
alter table public.job_post_receipts enable row level security;
grant select on public.job_post_receipts to authenticated;
create policy "Read own post usage" on public.job_post_receipts for select to authenticated using(employer_id=(select auth.uid()) or public.is_admin());

create function public.post_allowance()
returns table(free_left int,credits_left int,premium_left int,premium_active boolean)
language sql stable security invoker set search_path='' as $$
  with usage as (
    select source, created_at >= date_trunc('month', now() at time zone 'UTC') at time zone 'UTC' as this_month
    from public.job_post_receipts where employer_id=(select auth.uid())
  )
  select greatest(0,s.free_posts-(select count(*)::int from usage where source='free' and (s.free_period='lifetime' or this_month))),
    greatest(0,(select count(*)::int from public.employer_payment_requests where employer_id=(select auth.uid()) and product='post' and status='approved')-
      (select count(*)::int from usage where source='credit')),
    case when s.premium_monthly_limit is null then null else greatest(0,s.premium_monthly_limit-(select count(*)::int from usage where source='premium' and this_month)) end,
    public.has_active_employer_premium()
  from public.employer_payment_settings s where id=1
$$;
revoke all on function public.post_allowance() from public;
grant execute on function public.post_allowance() to authenticated;

create function public.record_job_post() returns trigger
language plpgsql security definer set search_path='' as $$
declare allowance record; used text;
begin
  if new.service_offer_id is not null or auth.uid() is null or public.is_admin() then return new; end if;
  if auth.uid() <> new.employer_id then raise exception 'Employer account required'; end if;
  perform 1 from public.profiles where id=new.employer_id for update;
  select * into allowance from public.post_allowance();
  if allowance.premium_active and (allowance.premium_left is null or allowance.premium_left>0) then used:='premium';
  elsif allowance.free_left>0 then used:='free';
  elsif allowance.credits_left>0 then used:='credit';
  else raise exception 'posting_limit_reached'; end if;
  insert into public.job_post_receipts(job_id,employer_id,source) values(new.id,new.employer_id,used);
  return new;
end;$$;
revoke all on function public.record_job_post() from public;
create trigger jobs_record_post after insert on public.jobs for each row execute function public.record_job_post();
drop policy "Premium employers create their own job listings" on public.jobs;
create policy "Employers create metered posts" on public.jobs for insert to authenticated with check
(employer_id=auth.uid() and public.current_account_role()='employer' and status in ('draft','pending_review','published'));

drop policy "Employers submit payment proof" on public.employer_payment_requests;
create policy "Employers submit priced payment proof" on public.employer_payment_requests for insert to authenticated with check (
 employer_id=auth.uid() and public.current_account_role()='employer' and status='pending' and review_note=''
 and reviewed_by is null and reviewed_at is null and (storage.foldername(proof_path))[1]=auth.uid()::text
 and exists(select 1 from public.employer_payment_settings s where s.id=1
 and (case when product='post' then s.single_post_npr else s.premium_price_npr end)=amount_npr
 and (case when product='post' then 1 else s.premium_duration_days end)=plan_duration_days
 and (case payment_method when 'esewa' then s.esewa_account_id<>''
 when 'khalti' then s.khalti_account_id<>'' or s.khalti_payment_url<>''
 when 'international' then (case when product='post' then s.single_checkout_url else s.premium_checkout_url end) like 'https://%'
 when 'bank' then s.bank_name<>'' and s.bank_account_number<>'' else false end))
);
create or replace function public.approve_employer_payment_request(p_request_id uuid, p_review_note text default '')
returns timestamptz
language plpgsql
security definer
set search_path = public
as $$
declare
  payment_request public.employer_payment_requests%rowtype;
  premium_until timestamptz;
begin
  if not public.is_admin() then
    raise exception 'Only an administrator can approve employer payments';
  end if;

  select * into payment_request
  from public.employer_payment_requests
  where id = p_request_id
  for update;

  if not found or payment_request.status <> 'pending' then
    raise exception 'This payment request is no longer waiting for review';
  end if;

  if payment_request.product = 'premium' then
  update public.profiles
    set employer_premium_until = greatest(coalesce(employer_premium_until, now()), now()) + make_interval(days => payment_request.plan_duration_days)
    where id = payment_request.employer_id and role = 'employer'
    returning employer_premium_until into premium_until;

  if premium_until is null then
    raise exception 'The employer account no longer exists';
  end if;

  end if;

  update public.employer_payment_requests
    set status = 'approved', review_note = left(coalesce(p_review_note, ''), 1000), reviewed_by = auth.uid(), reviewed_at = now()
    where id = p_request_id;

  return premium_until;
end;
$$;


-- A listing purchase enables hiring only for that employer's corresponding post.
create function public.has_post_receipt(p_job uuid) returns boolean language sql stable security invoker
set search_path='' as $$
select exists(select 1 from public.job_post_receipts where employer_id=(select auth.uid())
  and job_id=p_job and source in ('free','credit'))
$$;
revoke all on function public.has_post_receipt(uuid) from public;
grant execute on function public.has_post_receipt(uuid) to authenticated;
create policy "Review applicants for covered posts" on public.applications for select to authenticated using(public.has_post_receipt(job_id));
create policy "Update applicants for covered posts" on public.applications for update to authenticated
using(public.has_post_receipt(job_id)) with check(public.has_post_receipt(job_id));
create policy "Edit own covered posts" on public.jobs for update to authenticated
using(employer_id=auth.uid() and public.has_post_receipt(id)) with check(employer_id=auth.uid() and public.has_post_receipt(id));

create or replace function public.can_read_conversation(p_application uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select auth.uid() is not null and (public.is_admin() or exists (
    select 1 from public.applications a join public.jobs j on j.id=a.job_id
    where a.id=p_application and (a.applicant_id=auth.uid() or (j.employer_id=auth.uid() and (public.has_active_employer_premium() or public.has_post_receipt(j.id))))
  ));
$$;

create or replace function public.protect_hiring_stage() returns trigger language plpgsql set search_path=public as $$
begin
 if old.status is distinct from new.status and old.hiring_stage=new.hiring_stage and new.status in ('submitted','shortlisted','rejected') then new.hiring_stage := case when new.status='submitted' then 'new' else new.status::text end; end if;
 if old.hiring_stage is distinct from new.hiring_stage and coalesce(auth.role(),'')<>'service_role' and not public.is_admin() and (public.current_account_role()<>'employer' or not (public.has_active_employer_premium() or public.has_post_receipt(old.job_id)) or not exists(select 1 from public.jobs j where j.id=old.job_id and j.employer_id=auth.uid())) then raise exception 'Only the hiring team can change hiring stages'; end if;
 return new;
end;$$;

create or replace function public.save_hiring_review(p_application uuid,p_stage text,p_notes text) returns void language plpgsql security definer set search_path=public as $$
declare candidate public.applications%rowtype;
begin
 if not (public.has_active_employer_premium() or public.has_post_receipt((select job_id from public.applications where id=p_application))) then raise exception 'Active employer Premium required'; end if;
 if p_stage not in ('new','shortlisted','interview','hired','rejected') or char_length(p_notes)>5000 or p_notes is null then raise exception 'Invalid hiring review'; end if;
 select a.* into candidate from public.applications a join public.jobs j on j.id=a.job_id where a.id=p_application and j.employer_id=auth.uid() for update of a;
 if not found or candidate.status='withdrawn' then raise exception 'Application unavailable'; end if;
 update public.applications set hiring_stage=p_stage,status=case when p_stage='new' then 'submitted'::public.application_status when p_stage='rejected' then 'rejected'::public.application_status else 'shortlisted'::public.application_status end where id=p_application;
 insert into public.hiring_reviews(application_id,notes) values(p_application,p_notes) on conflict(application_id) do update set notes=excluded.notes,updated_at=now();
end;$$;

create or replace function public.propose_interview(p_application uuid,p_starts_at timestamptz,p_duration integer,p_url text,p_location text,p_instructions text) returns uuid language plpgsql security definer set search_path=public as $$
declare a public.applications%rowtype; e uuid; result uuid;
begin
 if not (public.has_active_employer_premium() or public.has_post_receipt((select job_id from public.applications where id=p_application))) then raise exception 'Active employer Premium required'; end if;
 select a1.* into a from public.applications a1 join public.jobs j on j.id=a1.job_id where a1.id=p_application and j.employer_id=auth.uid();
 if not found then raise exception 'Application unavailable'; end if;
 e:=auth.uid();
 perform 1 from public.applications where id=p_application for update;
 select * into a from public.applications where id=p_application;
 if a.status not in ('submitted','shortlisted') or a.hiring_stage='hired' then raise exception 'Application is no longer active'; end if;
 if p_starts_at is null or p_starts_at<=now() or p_starts_at>now()+interval '180 days' or p_duration is null or p_duration not between 15 and 240 then raise exception 'Choose a future interview within 180 days'; end if;
 if p_url is null or p_location is null or p_instructions is null or char_length(p_url)>500 or char_length(p_location)>250 or char_length(p_instructions)>1500 or (btrim(p_url)='' and btrim(p_location)='') or (p_url<>'' and p_url!~ '^https://[^[:space:]]+$') then raise exception 'Enter a secure meeting link or location'; end if;
 perform pg_advisory_xact_lock(hashtext(least(e::text,a.applicant_id::text)));
 perform pg_advisory_xact_lock(hashtext(greatest(e::text,a.applicant_id::text)));
 if exists(select 1 from public.interviews i where i.application_id<>p_application and i.status in ('proposed','accepted') and (i.employer_id=e or i.applicant_id=a.applicant_id) and i.starts_at<p_starts_at+make_interval(mins=>p_duration) and i.starts_at+make_interval(mins=>i.duration_minutes)>p_starts_at) then raise exception 'Interview overlaps another active invitation'; end if;
 update public.interviews set status='superseded',updated_at=now() where application_id=p_application and status in ('proposed','accepted','reschedule_requested');
 insert into public.interviews(application_id,employer_id,applicant_id,starts_at,duration_minutes,meeting_url,location,instructions) values(p_application,e,a.applicant_id,p_starts_at,p_duration,p_url,p_location,p_instructions) returning id into result;
 update public.applications set hiring_stage='interview',status='shortlisted' where id=p_application;
 return result;
end;$$;

create or replace function public.assign_job_worker(p_application uuid) returns uuid language plpgsql security definer set search_path=public as $$
declare a public.applications%rowtype;j public.jobs%rowtype;result uuid;
begin
 if auth.uid() is null then raise exception 'Employer account required';end if;
 select * into a from public.applications where id=p_application;
 select * into j from public.jobs where id=a.job_id for update;
 if not (public.has_active_employer_premium() or public.has_post_receipt(a.job_id)) or j.id is null or j.employer_id<>auth.uid() or j.status<>'published' or j.archived_at is not null or public.job_filled_seats(j.id)>=j.worker_count then raise exception 'Job unavailable or full';end if;
 select * into a from public.applications where id=p_application for update;
 if a.status in('withdrawn','rejected') then raise exception 'Application unavailable';end if;
 insert into public.job_assignments(job_id,application_id,employer_id,worker_id) values(j.id,a.id,j.employer_id,a.applicant_id) returning id into result;
 update public.applications set hiring_stage='hired',status='shortlisted' where id=a.id;
 if public.job_filled_seats(j.id)>=j.worker_count then update public.jobs set status='closed' where id=j.id;end if;
 return result;
end;$$;

create or replace function public.notify_payment_event() returns trigger
language plpgsql security definer set search_path='' as $$
begin
  if old.status is distinct from new.status and new.status in ('approved','rejected') then
    insert into public.notifications(recipient_id,kind,title,href)
    values(new.employer_id,'payment',
      case when new.status='rejected' then 'Your payment needs attention'
           when new.product='post' then 'Your posting credit is ready'
           else 'Your Premium payment was approved' end,
      '/dashboard/billing');
  end if;
  return new;
end;$$;
