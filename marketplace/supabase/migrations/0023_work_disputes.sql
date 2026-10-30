begin;
create table public.work_disputes (
 id uuid primary key default gen_random_uuid(),assignment_id uuid not null references public.job_assignments(id) on delete restrict,
 reporter_id uuid not null references public.profiles(id),respondent_id uuid not null references public.profiles(id),
 reason text not null check(reason in ('no_show','unfinished','payment','misleading','conduct','other')),
 details text not null check(char_length(btrim(details)) between 20 and 4000),
 status text not null default 'open' check(status in ('open','reviewing','resolved','dismissed')),
 decision text not null default '',reviewed_by uuid references public.profiles(id),reviewed_at timestamptz,
 created_at timestamptz not null default now(),updated_at timestamptz not null default now(),unique(assignment_id,reporter_id)
);
create table public.work_dispute_messages (
 id uuid primary key default gen_random_uuid(),dispute_id uuid not null references public.work_disputes(id) on delete restrict,
 sender_id uuid not null references public.profiles(id),body text not null check(char_length(btrim(body)) between 5 and 4000),
 evidence_url text not null default '' check(evidence_url='' or (length(evidence_url)<=1000 and evidence_url ~ '^https://[^[:space:]]+$')),
 created_at timestamptz not null default now()
);
create table public.account_suspensions (
 id uuid primary key default gen_random_uuid(),account_id uuid not null references public.profiles(id),
 dispute_id uuid not null references public.work_disputes(id),reason text not null check(char_length(btrim(reason)) between 10 and 2000),
 starts_at timestamptz not null default now(),ends_at timestamptz not null,
 created_by uuid not null references public.profiles(id),revoked_at timestamptz,revoked_by uuid references public.profiles(id),restore_reason text,
 check(ends_at>starts_at and ends_at<=starts_at+interval '90 days')
);
create index account_suspension_lookup on public.account_suspensions(account_id,ends_at);
create index dispute_messages_order on public.work_dispute_messages(dispute_id,created_at);
alter table public.work_disputes enable row level security;
alter table public.work_dispute_messages enable row level security;
alter table public.account_suspensions enable row level security;
revoke all on public.work_disputes,public.work_dispute_messages,public.account_suspensions from public,anon,authenticated;
grant select on public.work_disputes,public.work_dispute_messages,public.account_suspensions to authenticated;
create policy "Private work cases" on public.work_disputes for select to authenticated using(reporter_id=auth.uid() or respondent_id=auth.uid() or public.is_admin());
create policy "Private case replies" on public.work_dispute_messages for select to authenticated using(exists(select 1 from public.work_disputes d where d.id=dispute_id and (d.reporter_id=auth.uid() or d.respondent_id=auth.uid() or public.is_admin())));
create policy "Own restriction history and admin oversight" on public.account_suspensions for select to authenticated using(account_id=auth.uid() or public.is_admin());
create function public.account_is_suspended(p_account uuid) returns boolean language sql stable security definer set search_path=public as $$
 select exists(select 1 from public.account_suspensions where account_id=p_account and revoked_at is null and ends_at>now());$$;
revoke all on function public.account_is_suspended(uuid) from public;
grant execute on function public.account_is_suspended(uuid) to anon,authenticated;
create function public.open_work_dispute(p_assignment uuid,p_reason text,p_details text,p_evidence text default '') returns uuid language plpgsql security definer set search_path=public as $$
declare w public.job_assignments%rowtype;r uuid;other_id uuid;
begin
 select * into w from public.job_assignments where id=p_assignment for update;
 if auth.uid() is null or w.id is null or auth.uid() not in(w.worker_id,w.employer_id) then raise exception 'Work case unavailable';end if;
 other_id:=case when auth.uid()=w.worker_id then w.employer_id else w.worker_id end;
 if char_length(btrim(coalesce(p_details,''))) not between 20 and 4000 then raise exception 'Explain the problem';end if;
 if exists(select 1 from public.work_disputes where assignment_id=w.id and reporter_id=auth.uid()) then raise exception 'A case already exists; reply there';end if;
 insert into public.work_disputes(assignment_id,reporter_id,respondent_id,reason,details) values(w.id,auth.uid(),other_id,p_reason,btrim(p_details)) returning id into r;
 insert into public.work_dispute_messages(dispute_id,sender_id,body,evidence_url) values(r,auth.uid(),btrim(p_details),coalesce(btrim(p_evidence),''));
 insert into public.notifications(recipient_id,kind,title,href) select id,'support','A work problem needs review','/dashboard/disputes/'||r from public.profiles where role='admin' or id=other_id;
 return r;
end;$$;
create function public.reply_work_dispute(p_dispute uuid,p_body text,p_evidence text default '') returns void language plpgsql security definer set search_path=public as $$
declare d public.work_disputes%rowtype;
begin
 select * into d from public.work_disputes where id=p_dispute for update;
 if auth.uid() is null or d.id is null or (auth.uid() not in(d.reporter_id,d.respondent_id) and not public.is_admin()) then raise exception 'Work case unavailable';end if;
 if d.status not in('open','reviewing') then raise exception 'Case closed; contact support for an appeal';end if;
 if (select count(*) from public.work_dispute_messages where sender_id=auth.uid() and created_at>now()-interval '1 hour')>=30 then raise exception 'Please wait before sending more replies';end if;
 insert into public.work_dispute_messages(dispute_id,sender_id,body,evidence_url) values(d.id,auth.uid(),btrim(p_body),coalesce(btrim(p_evidence),''));
 update public.work_disputes set updated_at=now() where id=d.id;
 insert into public.notifications(recipient_id,kind,title,href) select id,'support','A work case has a new reply','/dashboard/disputes/'||d.id from public.profiles where id<>auth.uid() and (role='admin' or id in(d.reporter_id,d.respondent_id));
end;$$;
create function public.review_work_dispute(p_dispute uuid,p_status text,p_decision text) returns void language plpgsql security definer set search_path=public as $$
declare d public.work_disputes%rowtype;
begin
 if not public.is_admin() then raise exception 'Admin required';end if;
 select * into d from public.work_disputes where id=p_dispute for update;
 if d.id is null or char_length(btrim(coalesce(p_decision,''))) not between 10 and 4000 then raise exception 'Give a review reason';end if;
 insert into public.work_dispute_messages(dispute_id,sender_id,body) values(d.id,auth.uid(),'Admin review ('||p_status||'): '||btrim(p_decision));
 update public.work_disputes set status=p_status,decision=btrim(p_decision),reviewed_by=auth.uid(),reviewed_at=now(),updated_at=now() where id=d.id;
 insert into public.notifications(recipient_id,kind,title,href) select id,'support','Admin updated your work case','/dashboard/disputes/'||d.id from public.profiles where id in(d.reporter_id,d.respondent_id);
end;$$;
create function public.suspend_case_account(p_dispute uuid,p_account uuid,p_days integer,p_reason text) returns uuid language plpgsql security definer set search_path=public as $$
declare d public.work_disputes%rowtype;r uuid;
begin
 if not public.is_admin() then raise exception 'Admin required';end if;
 select * into d from public.work_disputes where id=p_dispute for update;
 if d.id is null or d.status not in('reviewing','resolved') or d.reviewed_at is null or p_account not in(d.reporter_id,d.respondent_id) or p_days is null or p_days not between 1 and 90 then raise exception 'Review the case before restricting an account';end if;
 perform 1 from public.profiles where id=p_account for update;
 if p_account=auth.uid() or exists(select 1 from public.profiles where id=p_account and role='admin') then raise exception 'Admin accounts cannot be suspended here';end if;
 if public.account_is_suspended(p_account) then raise exception 'Account already suspended; restore before changing duration';end if;
 insert into public.account_suspensions(account_id,dispute_id,reason,ends_at,created_by) values(p_account,d.id,btrim(p_reason),now()+make_interval(days=>p_days),auth.uid()) returning id into r;
 -- Ads and promotions remain stopped after restoration; no automatic refund or extra paid time.
 update public.job_promotions set enabled=false where job_id in(select id from public.jobs where employer_id=p_account);
 update public.sponsor_banners set active=false where id in(select banner_id from public.advertising_requests where employer_id=p_account);
 insert into public.notifications(recipient_id,kind,title,href) values(p_account,'support','Your marketplace access is temporarily suspended. Review the reason and appeal.','/dashboard/disputes');
 return r;
end;$$;
create function public.restore_case_account(p_suspension uuid,p_reason text) returns void language plpgsql security definer set search_path=public as $$
declare s public.account_suspensions%rowtype;
begin
 if not public.is_admin() then raise exception 'Admin required';end if;
 if char_length(btrim(coalesce(p_reason,''))) not between 10 and 2000 then raise exception 'Explain the restoration';end if;
 select * into s from public.account_suspensions where id=p_suspension for update;
 if s.id is null or s.revoked_at is not null then raise exception 'Restriction unavailable';end if;
 update public.account_suspensions set revoked_at=now(),revoked_by=auth.uid(),restore_reason=btrim(p_reason) where id=s.id;
 insert into public.notifications(recipient_id,kind,title,href) values(s.account_id,'support','Admin restored your marketplace access','/dashboard/disputes');
end;$$;
-- Enforced in the database, including direct API calls and security-definer workflows.
create function public.guard_suspended_activity() returns trigger language plpgsql security definer set search_path=public as $$
begin
 if auth.uid() is not null and not public.is_admin() and public.account_is_suspended(auth.uid()) then raise exception 'Marketplace access suspended; you can still read records, reply to your case and contact support';end if;
 if tg_table_name='job_assignments' then
  if tg_op='INSERT' and (public.account_is_suspended(new.worker_id) or public.account_is_suspended(new.employer_id)) then raise exception 'Cannot assign a suspended account';end if;
 end if;
 if tg_table_name in('job_promotion_requests','advertising_requests') and tg_op='UPDATE' then
  if new.status='approved' and old.status<>'approved' and public.account_is_suspended(new.employer_id) then raise exception 'Restore the account before approving promotion';end if;
 end if;
 if tg_op='DELETE' then return old;end if;return new;
end;$$;
do $$declare t text;begin
 foreach t in array array['jobs','applications','job_assignments','application_messages','interviews','hiring_reviews','work_agreements','work_time_requests','work_reviews','job_promotion_requests','advertising_requests','employer_payment_requests'] loop
 execute format('create trigger suspended_activity_guard before insert or update or delete on public.%I for each row execute function public.guard_suspended_activity()',t);
 end loop;
end$$;
create policy "Suspended listings are private" on public.jobs as restrictive for select using(not public.account_is_suspended(employer_id) or employer_id=auth.uid() or public.is_admin() or public.is_assigned_job_worker(id));
revoke all on function public.open_work_dispute(uuid,text,text,text),public.reply_work_dispute(uuid,text,text),public.review_work_dispute(uuid,text,text),public.suspend_case_account(uuid,uuid,integer,text),public.restore_case_account(uuid,text),public.guard_suspended_activity() from public;
grant execute on function public.open_work_dispute(uuid,text,text,text),public.reply_work_dispute(uuid,text,text),public.review_work_dispute(uuid,text,text),public.suspend_case_account(uuid,uuid,integer,text),public.restore_case_account(uuid,text) to authenticated;
commit;
