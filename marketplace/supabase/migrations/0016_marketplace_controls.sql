begin;
create table public.marketplace_controls (
 id boolean primary key default true check(id),
 require_job_review boolean not null default false,
 report_threshold integer not null default 6 check(report_threshold between 2 and 100),
 moderation_notifications boolean not null default true,
 support_cleanup_enabled boolean not null default true,
 support_retention_hours integer not null default 24 check(support_retention_hours between 1 and 720),
 version integer not null default 1,
 updated_at timestamptz not null default now()
);
insert into public.marketplace_controls(id) values(true);
alter table public.marketplace_controls enable row level security;
revoke all on public.marketplace_controls from public,anon,authenticated;
grant select on public.marketplace_controls to authenticated;
create policy "Members read operating rules" on public.marketplace_controls for select to authenticated using(true);
create table public.marketplace_control_history (
 id bigint generated always as identity primary key,
 actor_id uuid references public.profiles(id) on delete set null,
 before_settings jsonb not null, after_settings jsonb not null, created_at timestamptz not null default now()
);
alter table public.marketplace_control_history enable row level security;
revoke all on public.marketplace_control_history from public,anon,authenticated;
grant select on public.marketplace_control_history to authenticated;
create policy "Admins read settings history" on public.marketplace_control_history for select to authenticated using(public.is_admin());
create function public.save_marketplace_controls(p_version integer,p_review boolean,p_threshold integer,p_notify boolean,p_cleanup boolean,p_hours integer,p_confirm_cleanup boolean default false)
returns void language plpgsql security definer set search_path=public as $$
declare old_settings public.marketplace_controls%rowtype; next_settings public.marketplace_controls%rowtype;
begin
 if auth.uid() is null or not public.is_admin() then raise exception 'Admin required'; end if;
 select * into old_settings from public.marketplace_controls where id for update;
 if old_settings.version<>p_version then raise exception 'settings_stale'; end if;
 if (p_cleanup is distinct from old_settings.support_cleanup_enabled or p_hours is distinct from old_settings.support_retention_hours) and not coalesce(p_confirm_cleanup,false) then raise exception 'cleanup_confirmation_required'; end if;
 update public.marketplace_controls set require_job_review=p_review,report_threshold=p_threshold,moderation_notifications=p_notify,support_cleanup_enabled=p_cleanup,support_retention_hours=p_hours,version=version+1,updated_at=now() where id returning * into next_settings;
 insert into public.marketplace_control_history(actor_id,before_settings,after_settings) values(auth.uid(),to_jsonb(old_settings),to_jsonb(next_settings));
end;$$;
revoke all on function public.save_marketplace_controls(integer,boolean,integer,boolean,boolean,integer,boolean) from public;
grant execute on function public.save_marketplace_controls(integer,boolean,integer,boolean,boolean,integer,boolean) to authenticated;

-- Publication is decided in the database, never by a submitted form value.
create function public.set_new_job_publication() returns trigger language plpgsql security definer set search_path=public as $$
begin
 if auth.uid() is not null and not public.is_admin() and new.status<>'draft' then
  new.status:=case when (select require_job_review from public.marketplace_controls where id) then 'pending_review'::public.job_status else 'published'::public.job_status end;
 end if;
 return new;
end;$$;
create trigger jobs_initial_publication before insert on public.jobs for each row execute function public.set_new_job_publication();
drop policy "Premium employers create their own job listings" on public.jobs;
create policy "Premium employers create their own job listings" on public.jobs for insert to authenticated with check(employer_id=auth.uid() and public.current_account_role()='employer' and public.has_active_employer_premium() and status in ('draft','pending_review','published'));
create or replace function public.protect_job_ownership_and_review_status() returns trigger language plpgsql security definer set search_path=public as $$
begin
 if auth.uid() is not null and coalesce(auth.role(),'')<>'service_role' and not public.is_admin() then
  if old.employer_id is distinct from new.employer_id then raise exception 'Job ownership cannot be changed'; end if;
  if new.status='rejected' and old.status is distinct from new.status then raise exception 'Admin required'; end if;
  -- Pending/rejected/closed listings cannot bypass moderation through editing or restore.
  if new.status='published' and old.status<>'published' then raise exception 'Only an administrator can republish this job'; end if;
  if old.status='published' and new.status='published' and (select require_job_review from public.marketplace_controls where id)
    and (to_jsonb(new)-array['updated_at','status','archived_at']) is distinct from (to_jsonb(old)-array['updated_at','status','archived_at']) then new.status:='pending_review'; end if;
 end if;
 return new;
end;$$;

-- Lock the listing before accepting each report. Distinct reporters are enforced
-- by the existing unique(job_id,reporter_id) constraint, including closed reports.
create function public.lock_reported_job() returns trigger language plpgsql security definer set search_path=public as $$
declare j public.jobs%rowtype;
begin
 select * into j from public.jobs where id=new.job_id for update;
 if auth.uid() is null or new.reporter_id<>auth.uid() or public.is_admin() or j.id is null or j.status<>'published' or j.archived_at is not null or j.employer_id=auth.uid() then raise exception 'Job unavailable for reporting'; end if;
 new.status:='open';new.reviewed_by:=null;new.reviewed_at:=null;new.created_at:=now();
 return new;
end;$$;
create trigger job_reports_lock before insert on public.job_reports for each row execute function public.lock_reported_job();
create function public.hold_reported_job() returns trigger language plpgsql security definer set search_path=public as $$
declare controls public.marketplace_controls%rowtype; owner_id uuid;
begin
 select * into controls from public.marketplace_controls where id;
 if (select count(*) from public.job_reports where job_id=new.job_id and status='open')>=controls.report_threshold then
  update public.jobs set status='pending_review' where id=new.job_id and status='published' and archived_at is null returning employer_id into owner_id;
  if found then
   insert into public.notifications(recipient_id,kind,title,href) values(owner_id,'listing','Your job is paused for review after community reports','/dashboard/jobs');
   if controls.moderation_notifications then
    insert into public.notifications(recipient_id,kind,title,href) select id,'moderation','A reported job needs your review','/dashboard/moderation' from public.profiles where role='admin';
   end if;
  end if;
 end if;
 return new;
end;$$;
create trigger job_reports_hold after insert on public.job_reports for each row execute function public.hold_reported_job();
-- Admin publication/rejection resolves the current report cycle. The same old
-- reports cannot immediately hide a restored listing again.
create function public.finish_job_report_review() returns trigger language plpgsql security definer set search_path=public as $$
begin
 if public.is_admin() and new.status is distinct from old.status and new.status in ('published','rejected') then
  update public.job_reports set status=case when new.status='published' then 'dismissed' else 'resolved' end,reviewed_by=auth.uid(),reviewed_at=now() where job_id=new.id and status='open';
 end if;
 return new;
end;$$;
create trigger jobs_finish_report_review after update on public.jobs for each row execute function public.finish_job_report_review();
create or replace function public.guard_job_workflow() returns trigger language plpgsql security definer set search_path=public as $$
begin
 if new.archived_at is not null and new.status<>'closed' then raise exception 'Archived jobs must remain closed'; end if;
 if exists(select 1 from public.job_assignments where job_id=old.id and state in ('assigned','in_progress','submitted','completed')) then
  if (to_jsonb(new)-array['status','updated_at','archived_at']) is distinct from (to_jsonb(old)-array['status','updated_at','archived_at']) then raise exception 'Assigned job terms cannot be edited'; end if;
  if exists(select 1 from public.job_assignments where job_id=old.id and state='assigned') and new.status not in ('published','pending_review','rejected') then raise exception 'Cancel the unstarted assignment before closing this job'; end if;
  if exists(select 1 from public.job_assignments where job_id=old.id and state in ('in_progress','submitted','completed')) and new.status<>'closed' then raise exception 'Started work cannot be republished'; end if;
  if new.archived_at is distinct from old.archived_at and exists(select 1 from public.job_assignments where job_id=old.id and state in ('assigned','in_progress','submitted')) then raise exception 'Finish or cancel the assignment before removing this job'; end if;
 end if;
 return new;
end;$$;
create or replace function public.purge_resolved_support() returns integer language plpgsql security definer set search_path=public as $$
declare ids uuid[]; removed integer; controls public.marketplace_controls%rowtype;
begin
 select * into controls from public.marketplace_controls where id for share;
 if not controls.support_cleanup_enabled then return 0; end if;
 -- Lock selected tickets so a simultaneous reopen cannot be deleted.
 select array_agg(id) into ids from (select id from public.support_tickets where status='resolved' and resolved_at <= now()-make_interval(hours=>controls.support_retention_hours) order by resolved_at limit 500 for update skip locked) expired;
 if ids is null then return 0; end if;
 delete from public.notifications where kind='support' and href in (select '/dashboard/support/'||id from unnest(ids) id);
 delete from public.support_tickets where id=any(ids) and status='resolved' and resolved_at <= now()-make_interval(hours=>controls.support_retention_hours);
 get diagnostics removed=row_count;
 return removed;
end;$$;

revoke all on function public.set_new_job_publication(),public.lock_reported_job(),public.hold_reported_job(),public.finish_job_report_review() from public;
-- No existing listings or reports are changed when controls are installed.
commit;
