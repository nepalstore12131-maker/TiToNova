begin;
alter table public.jobs add column archived_at timestamptz;
create table public.job_assignments (
 id uuid primary key default gen_random_uuid(),
 job_id uuid not null references public.jobs(id) on delete restrict,
 application_id uuid not null references public.applications(id) on delete restrict,
 employer_id uuid not null references public.profiles(id) on delete restrict,
 worker_id uuid not null references public.profiles(id) on delete restrict,
 state text not null default 'assigned' check(state in ('assigned','in_progress','submitted','completed','cancelled')),
 progress integer not null default 0 check(progress between 0 and 100),
 progress_note text not null default '' check(char_length(progress_note)<=2000),
 created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
 started_at timestamptz, completed_at timestamptz
);
create unique index one_active_worker_per_job on public.job_assignments(job_id) where state<>'cancelled';
alter table public.job_assignments enable row level security;
revoke all on public.job_assignments from anon,authenticated;
grant select on public.job_assignments to authenticated;
create policy "Work participants read assignment" on public.job_assignments for select to authenticated using(worker_id=auth.uid() or employer_id=auth.uid() or public.is_admin());
create function public.is_assigned_job_worker(p_job uuid) returns boolean language sql stable security definer set search_path=public as $$
 select exists(select 1 from public.job_assignments where job_id=p_job and worker_id=auth.uid() and state<>'cancelled');
$$;
revoke all on function public.is_assigned_job_worker(uuid) from public;
grant execute on function public.is_assigned_job_worker(uuid) to anon,authenticated;
drop policy "Published jobs are public; owners see their own" on public.jobs;
create policy "Open listings and private work access" on public.jobs for select using((status='published' and archived_at is null) or employer_id=auth.uid() or public.is_admin() or public.is_assigned_job_worker(id));
create function public.guard_job_workflow() returns trigger language plpgsql security definer set search_path=public as $$
begin
 if new.archived_at is not null and new.status<>'closed' then raise exception 'Archived jobs must remain closed'; end if;
 if exists(select 1 from public.job_assignments where job_id=old.id and state in ('assigned','in_progress','submitted','completed')) then
  if (to_jsonb(new)-array['status','updated_at','archived_at']) is distinct from (to_jsonb(old)-array['status','updated_at','archived_at']) then raise exception 'Assigned job terms cannot be edited'; end if;
  if exists(select 1 from public.job_assignments where job_id=old.id and state in ('in_progress','submitted','completed')) and new.status<>'closed' then raise exception 'Started work cannot be republished'; end if;
  if new.archived_at is distinct from old.archived_at and exists(select 1 from public.job_assignments where job_id=old.id and state in ('assigned','in_progress','submitted')) then raise exception 'Finish or cancel the assignment before removing this job'; end if;
 end if;
 return new;
end;$$;
create trigger jobs_guard_workflow before update on public.jobs for each row execute function public.guard_job_workflow();
create function public.guard_work_application() returns trigger language plpgsql security definer set search_path=public as $$
declare j public.jobs%rowtype;
begin
 if tg_op='INSERT' then
  select * into j from public.jobs where id=new.job_id for update;
  if not found or j.status<>'published' or j.archived_at is not null then raise exception 'This job no longer accepts applications'; end if;
 elsif new.status in ('withdrawn','rejected') and exists(select 1 from public.job_assignments where application_id=old.id and state in ('assigned','in_progress','submitted','completed')) then raise exception 'Assigned work must be managed in My work';
 end if;
 return new;
end;$$;
create trigger applications_guard_workflow before insert or update on public.applications for each row execute function public.guard_work_application();
create function public.assign_job_worker(p_application uuid) returns uuid language plpgsql security definer set search_path=public as $$
declare a public.applications%rowtype; j public.jobs%rowtype; result uuid;
begin
 if not public.has_active_employer_premium() then raise exception 'Employer Premium required'; end if;
 select * into a from public.applications where id=p_application;
 if not found then raise exception 'Application unavailable'; end if;
 select * into j from public.jobs where id=a.job_id for update;
 if j.employer_id<>auth.uid() or j.status<>'published' or j.archived_at is not null then raise exception 'Job unavailable'; end if;
 select * into a from public.applications where id=p_application for update;
 if a.status in ('withdrawn','rejected') then raise exception 'Application unavailable'; end if;
 insert into public.job_assignments(job_id,application_id,employer_id,worker_id) values(j.id,a.id,j.employer_id,a.applicant_id) returning id into result;
 update public.applications set hiring_stage='hired',status='shortlisted' where id=a.id;
 return result;
end;$$;
create function public.update_job_work(p_assignment uuid,p_action text,p_progress integer default 0,p_note text default '') returns void language plpgsql security definer set search_path=public as $$
declare w public.job_assignments%rowtype; j public.jobs%rowtype;
begin
 select * into w from public.job_assignments where id=p_assignment;
 if not found or auth.uid() is null then raise exception 'Assignment unavailable'; end if;
 select * into j from public.jobs where id=w.job_id for update;
 select * into w from public.job_assignments where id=p_assignment for update;
 if p_note is null or char_length(p_note)>2000 or p_progress is null or p_progress not between 0 and 100 then raise exception 'Invalid progress'; end if;
 if p_action='start' and w.worker_id=auth.uid() and w.state='assigned' and j.archived_at is null and j.status='published' then
  update public.job_assignments set state='in_progress',started_at=now(),updated_at=now() where id=w.id;
  update public.jobs set status='closed' where id=w.job_id;
 elsif p_action='progress' and w.worker_id=auth.uid() and w.state='in_progress' then
  update public.job_assignments set progress=p_progress,progress_note=p_note,updated_at=now() where id=w.id;
 elsif p_action='submit' and w.worker_id=auth.uid() and w.state='in_progress' then
  update public.job_assignments set state='submitted',progress=100,progress_note=p_note,updated_at=now() where id=w.id;
 elsif p_action='complete' and (w.employer_id=auth.uid() or public.is_admin()) and w.state='submitted' then
  update public.job_assignments set state='completed',progress_note=case when p_note='' then progress_note else p_note end,completed_at=now(),updated_at=now() where id=w.id;
 elsif p_action='revise' and (w.employer_id=auth.uid() or public.is_admin()) and w.state='submitted' then
  update public.job_assignments set state='in_progress',progress=p_progress,progress_note=p_note,updated_at=now() where id=w.id;
 elsif p_action='cancel' and (w.employer_id=auth.uid() or w.worker_id=auth.uid() or public.is_admin()) and w.state='assigned' then
  update public.job_assignments set state='cancelled',updated_at=now() where id=w.id;
 else raise exception 'This action is not available'; end if;
end;$$;
create function public.archive_job_listing(p_job uuid,p_restore boolean default false) returns void language plpgsql security definer set search_path=public as $$
declare j public.jobs%rowtype;
begin
 select * into j from public.jobs where id=p_job for update;
 if not found or auth.uid() is null or (j.employer_id<>auth.uid() and not public.is_admin()) then raise exception 'Job unavailable'; end if;
 if p_restore then
  if j.archived_at is null or not public.has_active_employer_premium() then raise exception 'Premium required to restore'; end if;
  update public.jobs set archived_at=null,status='pending_review' where id=j.id;
 else update public.jobs set archived_at=now(),status='closed' where id=j.id; end if;
end;$$;
revoke all on function public.assign_job_worker(uuid),public.update_job_work(uuid,text,integer,text),public.archive_job_listing(uuid,boolean) from public;
grant execute on function public.assign_job_worker(uuid),public.update_job_work(uuid,text,integer,text),public.archive_job_listing(uuid,boolean) to authenticated;
create function public.notify_job_work() returns trigger language plpgsql security definer set search_path=public as $$
begin
 if tg_op='INSERT' then
  insert into public.notifications(recipient_id,kind,title,href) values(new.worker_id,'work','You have been assigned a job. Open My work to start.','/dashboard/work');
 elsif old.state is distinct from new.state or old.progress is distinct from new.progress or old.progress_note is distinct from new.progress_note then
  insert into public.notifications(recipient_id,kind,title,href) values(case when auth.uid()=new.worker_id then new.employer_id else new.worker_id end,'work','Your assigned job has a progress update','/dashboard/work');
 end if;return new;
end;$$;
create trigger assignments_notify after insert or update on public.job_assignments for each row execute function public.notify_job_work();
commit;
