begin;
alter table public.jobs add column if not exists completed_at timestamptz;
create or replace function public.guard_job_workflow() returns trigger language plpgsql security definer set search_path=public as $$
begin
 if new.archived_at is not null and new.status<>'closed' then raise exception 'Archived jobs must remain closed';end if;
 if exists(select 1 from public.job_assignments where job_id=old.id and state<>'cancelled') then
  if (to_jsonb(new)-array['status','updated_at','archived_at','completed_at']) is distinct from (to_jsonb(old)-array['status','updated_at','archived_at','completed_at']) then raise exception 'Assigned job terms cannot be edited';end if;
  if new.archived_at is distinct from old.archived_at and exists(select 1 from public.job_assignments where job_id=old.id and state in('assigned','in_progress','submitted')) then raise exception 'Finish or cancel active assignments before removing';end if;
  if old.status='closed' and new.status='published' and public.job_filled_seats(old.id)>=new.worker_count then raise exception 'All positions are filled';end if;
 end if;return new;
end;$$;
-- Closed listings are finished only after every non-cancelled assignment is complete.
update public.jobs j set completed_at=coalesce((select max(w.completed_at) from public.job_assignments w where w.job_id=j.id and w.state='completed'),now())
where j.completed_at is null and j.status='closed'
 and exists(select 1 from public.job_assignments w where w.job_id=j.id and w.state='completed')
 and not exists(select 1 from public.job_assignments w where w.job_id=j.id and w.state not in('completed','cancelled'));
create function public.mark_job_completed_history() returns trigger language plpgsql security definer set search_path=public as $$
begin
 if new.state='completed' and old.state is distinct from new.state then
  perform 1 from public.jobs where id=new.job_id for update;
  update public.jobs j set completed_at=now() where j.id=new.job_id and j.status='closed' and j.completed_at is null
   and not exists(select 1 from public.job_assignments w where w.job_id=j.id and w.state not in('completed','cancelled'));
 end if;
 return new;
end;$$;
revoke all on function public.mark_job_completed_history() from public;
create trigger job_work_completed_history after update of state on public.job_assignments for each row execute function public.mark_job_completed_history();
create function public.protect_completed_job_history() returns trigger language plpgsql set search_path=public as $$
begin
 if old.completed_at is not null then raise exception 'Completed jobs are read-only'; end if;
 if new.completed_at is distinct from old.completed_at and pg_trigger_depth()<2 then raise exception 'Completion is set by the work process'; end if;
 return new;
end;$$;
revoke all on function public.protect_completed_job_history() from public;
create trigger completed_job_read_only before update on public.jobs for each row execute function public.protect_completed_job_history();
create function public.protect_completed_application_history() returns trigger language plpgsql set search_path=public as $$
begin
 if exists(select 1 from public.jobs where id=old.job_id and completed_at is not null) then raise exception 'Applications for completed jobs are read-only'; end if;
 return new;
end;$$;
revoke all on function public.protect_completed_application_history() from public;
create trigger completed_application_read_only before update on public.applications for each row execute function public.protect_completed_application_history();
commit;
