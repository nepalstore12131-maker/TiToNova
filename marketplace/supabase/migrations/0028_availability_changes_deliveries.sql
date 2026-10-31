begin;
create table public.worker_availability(id uuid primary key default gen_random_uuid(),worker_id uuid not null references public.profiles(id),starts_at timestamptz not null,ends_at timestamptz not null,created_at timestamptz not null default now(),check(ends_at>starts_at and ends_at<=starts_at+interval '24 hours'));
alter table public.worker_availability enable row level security;revoke all on public.worker_availability from public,anon,authenticated;grant select on public.worker_availability to authenticated;
create policy "Availability for workers and interested hirers" on public.worker_availability for select to authenticated using(worker_id=auth.uid() or public.is_admin() or (public.current_account_role()='employer' and not public.account_is_suspended(worker_id) and ends_at>now()));
create function public.save_worker_availability(p_id uuid,p_start timestamptz,p_end timestamptz,p_remove boolean default false) returns void language plpgsql security definer set search_path=public as $$
begin
 if auth.uid() is null or public.current_account_role()<>'freelancer' or public.account_is_suspended(auth.uid()) then raise exception 'Worker required';end if;
 perform pg_advisory_xact_lock(hashtextextended(auth.uid()::text,28));
 if p_remove then delete from public.worker_availability where id=p_id and worker_id=auth.uid();return;end if;
 if p_start is null or p_end is null or p_start<=now() or p_start>now()+interval '180 days' or p_end<=p_start or p_end>p_start+interval '24 hours' then raise exception 'Choose a future slot within 180 days, up to 24 hours long';end if;
 if (select count(*) from public.worker_availability where worker_id=auth.uid() and ends_at>now())>=30 then raise exception 'Maximum 30 future slots';end if;
 if exists(select 1 from public.worker_availability where worker_id=auth.uid() and starts_at<p_end and ends_at>p_start) then raise exception 'This overlaps another availability slot';end if;
 insert into public.worker_availability(worker_id,starts_at,ends_at) values(auth.uid(),p_start,p_end);
end;$$;
create table public.work_change_requests(id uuid primary key default gen_random_uuid(),assignment_id uuid not null references public.job_assignments(id),requester_id uuid not null references public.profiles(id),kind text not null check(kind in('cancel','reschedule')),reason text not null check(char_length(btrim(reason)) between 5 and 2000),start_at timestamptz,due_at timestamptz,baseline_start timestamptz,baseline_due timestamptz,baseline_state text not null,status text not null default 'pending' check(status in('pending','approved','rejected','withdrawn')),reviewed_by uuid references public.profiles(id),reviewed_at timestamptz,decision_note text not null default '' check(char_length(decision_note)<=2000),created_at timestamptz not null default now(),check(due_at is null or (start_at is not null and due_at>start_at)));
create unique index work_one_pending_change on public.work_change_requests(assignment_id) where status='pending';
alter table public.work_change_requests enable row level security;revoke all on public.work_change_requests from public,anon,authenticated;grant select on public.work_change_requests to authenticated;
create policy "Work participants read change requests" on public.work_change_requests for select to authenticated using(exists(select 1 from public.job_assignments w where w.id=assignment_id and (w.worker_id=auth.uid() or w.employer_id=auth.uid() or public.is_admin())));
create function public.request_work_change(p_assignment uuid,p_kind text,p_reason text,p_start timestamptz default null,p_due timestamptz default null) returns void language plpgsql security definer set search_path=public as $$
declare w public.job_assignments%rowtype;
begin
 select * into w from public.job_assignments where id=p_assignment for update;
 if auth.uid() is null or w.id is null or auth.uid() not in(w.worker_id,w.employer_id) or w.state not in('assigned','in_progress','submitted') or public.account_is_suspended(auth.uid()) then raise exception 'Change request unavailable';end if;
 if p_kind='reschedule' and (w.state<>'assigned' or p_start is null or p_start<=now() or p_start>now()+interval '2 years' or p_due>now()+interval '3 years') then raise exception 'Reschedule unstarted work with future times';end if;
 insert into public.work_change_requests(assignment_id,requester_id,kind,reason,start_at,due_at,baseline_start,baseline_due,baseline_state) values(w.id,auth.uid(),p_kind,btrim(p_reason),case when p_kind='reschedule' then p_start end,case when p_kind='reschedule' then p_due end,w.scheduled_start_at,w.due_at,w.state);
 insert into public.notifications(recipient_id,kind,title,href) values(case when auth.uid()=w.worker_id then w.employer_id else w.worker_id end,'work','Review a work cancellation or time-change request','/dashboard/work/'||w.id);
end;$$;
create function public.review_work_change(p_request uuid,p_action text,p_note text default '') returns void language plpgsql security definer set search_path=public as $$
declare c public.work_change_requests%rowtype;w public.job_assignments%rowtype;
begin
 select * into c from public.work_change_requests where id=p_request;
 select * into w from public.job_assignments where id=c.assignment_id for update;
 select * into c from public.work_change_requests where id=p_request for update;
 if auth.uid() is null or w.id is null or c.status<>'pending' or public.account_is_suspended(auth.uid()) then raise exception 'Request unavailable';end if;
 if p_action='withdraw' and c.requester_id=auth.uid() then update public.work_change_requests set status='withdrawn',reviewed_by=auth.uid(),reviewed_at=now() where id=c.id;return;end if;
 if auth.uid()=c.requester_id or (auth.uid() not in(w.worker_id,w.employer_id) and not public.is_admin()) or p_action not in('approve','reject') then raise exception 'Other participant or admin must decide';end if;
 if p_action='approve' then
  if w.state is distinct from c.baseline_state or w.scheduled_start_at is distinct from c.baseline_start or w.due_at is distinct from c.baseline_due or w.state in('completed','cancelled') then raise exception 'Work changed; reject and request again';end if;
  if c.kind='cancel' then update public.job_assignments set state='cancelled',progress_note=c.reason,updated_at=now() where id=w.id;
  else
   if c.start_at<=now() then raise exception 'Proposed time has passed';end if;
   update public.job_assignments set scheduled_start_at=c.start_at,due_at=c.due_at,schedule_accepted_at=now(),updated_at=now() where id=w.id;
   -- Existing agreement snapshot remains unchanged: revised agreement is required before starting.
   update public.work_time_requests set status='cancelled',decision_note='Replaced by agreed rescheduling',reviewed_at=now(),reviewed_by=auth.uid() where assignment_id=w.id and status='pending';
  end if;
 end if;
 update public.work_change_requests set status=case when p_action='approve' then 'approved' else 'rejected' end,reviewed_by=auth.uid(),reviewed_at=now(),decision_note=coalesce(p_note,'') where id=c.id;
 insert into public.work_timeline(assignment_id,actor_id,event,note) values(w.id,auth.uid(),c.kind||' request '||p_action,coalesce(p_note,''));
 insert into public.notifications(recipient_id,kind,title,href) values(c.requester_id,'work','Your work change request has a decision','/dashboard/work/'||w.id);
end;$$;
create table public.work_deliveries(id uuid primary key default gen_random_uuid(),assignment_id uuid not null references public.job_assignments(id),worker_id uuid not null references public.profiles(id),revision integer not null,summary text not null check(char_length(btrim(summary)) between 5 and 2000),links text[] not null default '{}' check(public.valid_work_sample_links(links)),status text not null default 'submitted' check(status in('submitted','accepted','changes_requested')),review_note text not null default '' check(char_length(review_note)<=2000),reviewed_by uuid references public.profiles(id),reviewed_at timestamptz,created_at timestamptz not null default now(),unique(assignment_id,revision));
alter table public.work_deliveries enable row level security;revoke all on public.work_deliveries from public,anon,authenticated;grant select on public.work_deliveries to authenticated;
create policy "Work participants read deliveries" on public.work_deliveries for select to authenticated using(exists(select 1 from public.job_assignments w where w.id=assignment_id and (w.worker_id=auth.uid() or w.employer_id=auth.uid() or public.is_admin())));
create function public.submit_work_delivery(p_assignment uuid,p_summary text,p_links text[] default '{}') returns void language plpgsql security definer set search_path=public as $$
declare w public.job_assignments%rowtype;n integer;
begin
 select * into w from public.job_assignments where id=p_assignment for update;
 if auth.uid() is null or w.id is null or w.worker_id<>auth.uid() or w.state<>'in_progress' or public.account_is_suspended(auth.uid()) then raise exception 'Delivery unavailable';end if;
 select coalesce(max(revision),0)+1 into n from public.work_deliveries where assignment_id=w.id;
 insert into public.work_deliveries(assignment_id,worker_id,revision,summary,links) values(w.id,auth.uid(),n,btrim(p_summary),p_links);
 perform public.update_job_work(w.id,'submit',100,btrim(p_summary));
end;$$;
-- Existing completion/revision buttons also update the latest delivery record.
create function public.track_delivery_review() returns trigger language plpgsql security definer set search_path=public as $$
begin
 if old.state='submitted' and new.state in('completed','in_progress') then
  update public.work_deliveries set status=case when new.state='completed' then 'accepted' else 'changes_requested' end,review_note=new.progress_note,reviewed_by=auth.uid(),reviewed_at=now() where assignment_id=new.id and status='submitted';
 end if;return new;
end;$$;
create trigger assignments_delivery_review after update on public.job_assignments for each row execute function public.track_delivery_review();
revoke all on function public.save_worker_availability(uuid,timestamptz,timestamptz,boolean),public.request_work_change(uuid,text,text,timestamptz,timestamptz),public.review_work_change(uuid,text,text),public.submit_work_delivery(uuid,text,text[]),public.track_delivery_review() from public;
grant execute on function public.save_worker_availability(uuid,timestamptz,timestamptz,boolean),public.request_work_change(uuid,text,text,timestamptz,timestamptz),public.review_work_change(uuid,text,text),public.submit_work_delivery(uuid,text,text[]) to authenticated;
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
  raise exception 'Request cancellation from the work details page';
 else raise exception 'This action is not available'; end if;
end;$$;


create function public.request_reopen_positions(p_job uuid) returns void language plpgsql security definer set search_path=public as $$
declare j public.jobs%rowtype;
begin
 select * into j from public.jobs where id=p_job for update;
 if auth.uid() is null or j.id is null or j.employer_id<>auth.uid() or j.status<>'closed' or j.archived_at is not null or j.service_offer_id is not null or not public.has_active_employer_premium() or public.account_is_suspended(auth.uid()) or public.job_filled_seats(j.id)>=j.worker_count then raise exception 'No reopenable positions';end if;
 update public.jobs set status='pending_review' where id=j.id;
 insert into public.notifications(recipient_id,kind,title,href) select id,'moderation','A hirer wants to reopen available positions','/admin/jobs' from public.profiles where role='admin';
end;$$;
revoke all on function public.request_reopen_positions(uuid) from public;grant execute on function public.request_reopen_positions(uuid) to authenticated;

commit;
