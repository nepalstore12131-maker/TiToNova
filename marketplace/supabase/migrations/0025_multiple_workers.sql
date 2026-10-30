begin;
alter table public.jobs add column worker_count integer not null default 1 check(worker_count between 1 and 50);
drop index public.one_active_worker_per_job;
create unique index one_active_assignment_per_worker on public.job_assignments(job_id,worker_id) where state<>'cancelled';
create function public.job_filled_seats(p_job uuid) returns integer language sql stable security definer set search_path=public as $$ select count(*)::integer from public.job_assignments where job_id=p_job and state<>'cancelled'; $$;
revoke all on function public.job_filled_seats(uuid) from public;
grant execute on function public.job_filled_seats(uuid) to anon,authenticated;
create function public.guard_assignment_capacity() returns trigger language plpgsql security definer set search_path=public as $$
declare capacity integer;
begin
 select worker_count into capacity from public.jobs where id=new.job_id for update;
 if new.state<>'cancelled' and public.job_filled_seats(new.job_id)>=capacity then raise exception 'All positions are filled';end if;
 return new;
end;$$;
create trigger assignments_capacity before insert on public.job_assignments for each row execute function public.guard_assignment_capacity();
revoke all on function public.guard_assignment_capacity() from public;
create or replace function public.guard_job_workflow() returns trigger language plpgsql security definer set search_path=public as $$
begin
 if new.archived_at is not null and new.status<>'closed' then raise exception 'Archived jobs must remain closed';end if;
 if exists(select 1 from public.job_assignments where job_id=old.id and state<>'cancelled') then
  if (to_jsonb(new)-array['status','updated_at','archived_at']) is distinct from (to_jsonb(old)-array['status','updated_at','archived_at']) then raise exception 'Assigned job terms cannot be edited';end if;
  if new.archived_at is distinct from old.archived_at and exists(select 1 from public.job_assignments where job_id=old.id and state in('assigned','in_progress','submitted')) then raise exception 'Finish or cancel active assignments before removing';end if;
  if old.status='closed' and new.status='published' and public.job_filled_seats(old.id)>=new.worker_count then raise exception 'All positions are filled';end if;
 end if;return new;
end;$$;
create or replace function public.guard_work_application() returns trigger language plpgsql security definer set search_path=public as $$
declare j public.jobs%rowtype;
begin
 if tg_op='INSERT' then
  select * into j from public.jobs where id=new.job_id for update;
  if j.id is null or j.status<>'published' or j.archived_at is not null or public.job_filled_seats(j.id)>=j.worker_count then raise exception 'This job no longer accepts applications';end if;
 elsif new.status in('withdrawn','rejected') and exists(select 1 from public.job_assignments where application_id=old.id and state<>'cancelled') then raise exception 'Assigned work must be managed in My work';end if;return new;
end;$$;
create or replace function public.assign_job_worker(p_application uuid) returns uuid language plpgsql security definer set search_path=public as $$
declare a public.applications%rowtype;j public.jobs%rowtype;result uuid;
begin
 if auth.uid() is null or not public.has_active_employer_premium() then raise exception 'Employer Premium required';end if;
 select * into a from public.applications where id=p_application;
 select * into j from public.jobs where id=a.job_id for update;
 if j.id is null or j.employer_id<>auth.uid() or j.status<>'published' or j.archived_at is not null or public.job_filled_seats(j.id)>=j.worker_count then raise exception 'Job unavailable or full';end if;
 select * into a from public.applications where id=p_application for update;
 if a.status in('withdrawn','rejected') then raise exception 'Application unavailable';end if;
 insert into public.job_assignments(job_id,application_id,employer_id,worker_id) values(j.id,a.id,j.employer_id,a.applicant_id) returning id into result;
 update public.applications set hiring_stage='hired',status='shortlisted' where id=a.id;
 if public.job_filled_seats(j.id)>=j.worker_count then update public.jobs set status='closed' where id=j.id;end if;
 return result;
end;$$;
create or replace function public.update_job_work(p_assignment uuid,p_action text,p_progress integer default 0,p_note text default '') returns void language plpgsql security definer set search_path=public as $$
declare w public.job_assignments%rowtype; j public.jobs%rowtype;
begin
 select * into w from public.job_assignments where id=p_assignment;
 if not found or auth.uid() is null then raise exception 'Assignment unavailable'; end if;
 select * into j from public.jobs where id=w.job_id for update;
 select * into w from public.job_assignments where id=p_assignment for update;
 if p_note is null or char_length(p_note)>2000 or p_progress is null or p_progress not between 0 and 100 then raise exception 'Invalid progress'; end if;
 if p_action='start' and w.worker_id=auth.uid() and w.state='assigned' and j.archived_at is null and j.status in ('published','closed') then
  update public.job_assignments set state='in_progress',started_at=now(),updated_at=now() where id=w.id;
  if public.job_filled_seats(j.id)>=j.worker_count then update public.jobs set status='closed' where id=w.job_id;end if;
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
create or replace function public.invite_previous_worker(p_worker uuid,p_job uuid,p_note text) returns uuid language plpgsql security definer set search_path=public as $$
declare j public.jobs%rowtype;r uuid;
begin
 select * into j from public.jobs where id=p_job for update;
 if auth.uid() is null or j.id is null or j.employer_id<>auth.uid() or not public.has_active_employer_premium() or public.account_is_suspended(auth.uid()) or public.account_is_suspended(p_worker) then raise exception 'Invitation unavailable';end if;
 if j.status<>'published' or j.archived_at is not null or (j.applications_open_at is not null and j.applications_open_at>now()) or (j.applications_close_at is not null and j.applications_close_at<=now()) or public.job_filled_seats(j.id)>=j.worker_count then raise exception 'Choose an open job with an available position';end if;
 if not exists(select 1 from public.job_assignments where employer_id=auth.uid() and worker_id=p_worker and state='completed') then raise exception 'Previous completed work required';end if;
 if exists(select 1 from public.applications where job_id=j.id and applicant_id=p_worker) then raise exception 'This worker already applied; review that application';end if;
 perform pg_advisory_xact_lock(hashtextextended(auth.uid()::text,24));
 if (select count(*) from public.rehire_invitations where employer_id=auth.uid() and created_at>now()-interval '1 day')>=20 then raise exception 'Daily invitation limit reached';end if;
 insert into public.rehire_invitations(employer_id,worker_id,job_id,note) values(auth.uid(),p_worker,j.id,btrim(p_note)) returning id into r;
 insert into public.notifications(recipient_id,kind,title,href) values(p_worker,'hiring','A previous hirer invited you to a new job','/dashboard/invitations');return r;
end;$$;
create or replace function public.respond_rehire_invitation(p_invitation uuid,p_action text) returns void language plpgsql security definer set search_path=public as $$
declare i public.rehire_invitations%rowtype;j public.jobs%rowtype;a uuid;
begin
 select * into i from public.rehire_invitations where id=p_invitation;
 select * into j from public.jobs where id=i.job_id for update;
 select * into i from public.rehire_invitations where id=p_invitation for update;
 if auth.uid() is null or i.id is null or i.status<>'pending' then raise exception 'Invitation unavailable';end if;
 if p_action='cancel' and i.employer_id=auth.uid() then update public.rehire_invitations set status='cancelled',responded_at=now() where id=i.id;return;end if;
 if i.worker_id<>auth.uid() or p_action not in('accept','decline') then raise exception 'Only the invited worker can respond';end if;
 if p_action='decline' then update public.rehire_invitations set status='declined',responded_at=now() where id=i.id;
 else
  if public.account_is_suspended(auth.uid()) or public.account_is_suspended(i.employer_id) or j.status<>'published' or j.archived_at is not null or (j.applications_open_at is not null and j.applications_open_at>now()) or (j.applications_close_at is not null and j.applications_close_at<=now()) or public.job_filled_seats(j.id)>=j.worker_count then raise exception 'This job is no longer available';end if;
  select id into a from public.applications where job_id=j.id and applicant_id=auth.uid();
  if a is not null and exists(select 1 from public.applications where id=a and status in('withdrawn','rejected')) then raise exception 'Existing application is no longer active';end if;
  if a is null then insert into public.applications(job_id,applicant_id,cover_note) values(j.id,auth.uid(),'I accepted your invitation and would like to discuss this job.') returning id into a;end if;
  update public.rehire_invitations set status='accepted',application_id=a,responded_at=now() where id=i.id;
 end if;
 insert into public.notifications(recipient_id,kind,title,href) values(i.employer_id,'hiring','Your repeat-hiring invitation has a response','/dashboard/invitations');
end;$$;

-- Cancellation frees a seat but never republishes a closed or moderated listing automatically.
commit;
