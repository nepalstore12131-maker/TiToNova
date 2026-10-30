begin;
alter table public.job_assignments add column scheduled_start_at timestamptz, add column due_at timestamptz, add column schedule_accepted_at timestamptz, add column submitted_at timestamptz;
alter table public.job_assignments add constraint work_schedule_order check(due_at is null or (scheduled_start_at is not null and due_at>scheduled_start_at));
create table public.work_time_requests (
 id uuid primary key default gen_random_uuid(), assignment_id uuid not null references public.job_assignments(id) on delete cascade,
 requester_id uuid not null references public.profiles(id),
 proposed_start_at timestamptz not null, proposed_due_at timestamptz check(proposed_due_at is null or proposed_due_at>proposed_start_at),
 reason text not null check(char_length(reason) between 5 and 2000),
 status text not null default 'pending' check(status in ('pending','approved','rejected','cancelled')),
 decision_note text not null default '' check(char_length(decision_note)<=2000),
 reviewed_by uuid references public.profiles(id),reviewed_at timestamptz,created_at timestamptz not null default now()
);
create unique index work_one_pending_time_request on public.work_time_requests(assignment_id) where status='pending';
create table public.work_timeline (
 id uuid primary key default gen_random_uuid(),assignment_id uuid not null references public.job_assignments(id) on delete cascade,
 actor_id uuid references public.profiles(id) on delete set null,event text not null,note text not null default '',
 scheduled_start_at timestamptz,due_at timestamptz,created_at timestamptz not null default now()
);
alter table public.work_time_requests enable row level security;
alter table public.work_timeline enable row level security;
revoke all on public.work_time_requests,public.work_timeline from public,anon,authenticated;
grant select on public.work_time_requests,public.work_timeline to authenticated;
create policy "Work participants read time requests" on public.work_time_requests for select to authenticated using(exists(select 1 from public.job_assignments w where w.id=assignment_id and (w.worker_id=auth.uid() or w.employer_id=auth.uid() or public.is_admin())));
create policy "Work participants read timeline" on public.work_timeline for select to authenticated using(exists(select 1 from public.job_assignments w where w.id=assignment_id and (w.worker_id=auth.uid() or w.employer_id=auth.uid() or public.is_admin())));
create index work_timeline_assignment_date on public.work_timeline(assignment_id,created_at desc);
create function public.set_work_schedule(p_assignment uuid,p_start timestamptz,p_due timestamptz,p_note text default '') returns void language plpgsql security definer set search_path=public as $$
declare w public.job_assignments%rowtype;
begin
 select * into w from public.job_assignments where id=p_assignment for update;
 if auth.uid() is null or w.id is null or (w.employer_id<>auth.uid() and not public.is_admin()) or w.state<>'assigned' then raise exception 'Schedule unavailable';end if;
 if p_start is null or (p_due is not null and (p_due<=p_start or p_due<=now())) or p_start>now()+interval '2 years' or p_due>now()+interval '3 years' or char_length(coalesce(p_note,''))>2000 then raise exception 'Invalid schedule';end if;
 update public.job_assignments set scheduled_start_at=p_start,due_at=p_due,schedule_accepted_at=null,updated_at=now() where id=w.id;
 update public.work_time_requests set status='cancelled',decision_note='Replaced by a new proposed schedule',reviewed_by=auth.uid(),reviewed_at=now() where assignment_id=w.id and status='pending';
 insert into public.work_timeline(assignment_id,actor_id,event,note,scheduled_start_at,due_at) values(w.id,auth.uid(),'Schedule proposed',coalesce(p_note,''),p_start,p_due);
 insert into public.notifications(recipient_id,kind,title,href) values(w.worker_id,'work','Review the start time and deadline for your job','/dashboard/work/'||w.id);
end;$$;
create function public.accept_work_schedule(p_assignment uuid) returns void language plpgsql security definer set search_path=public as $$
declare w public.job_assignments%rowtype;
begin
 select * into w from public.job_assignments where id=p_assignment for update;
 if auth.uid() is null or w.id is null or w.worker_id<>auth.uid() or w.state<>'assigned' or w.scheduled_start_at is null or w.schedule_accepted_at is not null then raise exception 'Schedule unavailable';end if;
 update public.job_assignments set schedule_accepted_at=now(),updated_at=now() where id=w.id;
 insert into public.work_timeline(assignment_id,actor_id,event,scheduled_start_at,due_at) values(w.id,auth.uid(),'Schedule accepted',w.scheduled_start_at,w.due_at);
 insert into public.notifications(recipient_id,kind,title,href) values(w.employer_id,'work','Your worker accepted the job schedule','/dashboard/work/'||w.id);
end;$$;
create function public.request_work_time(p_assignment uuid,p_start timestamptz,p_due timestamptz,p_reason text) returns void language plpgsql security definer set search_path=public as $$
declare w public.job_assignments%rowtype;
begin
 select * into w from public.job_assignments where id=p_assignment for update;
 if auth.uid() is null or w.id is null or w.worker_id<>auth.uid() or w.state not in ('assigned','in_progress') or w.scheduled_start_at is null then raise exception 'Time request unavailable';end if;
 if p_start is null or (p_due is not null and (p_due<=p_start or p_due<=now())) or p_start>now()+interval '2 years' or p_due>now()+interval '3 years' or char_length(btrim(coalesce(p_reason,''))) not between 5 and 2000 then raise exception 'Invalid time request';end if;
 if w.state='in_progress' and (p_start is distinct from w.scheduled_start_at or w.due_at is null or p_due is null or p_due<=w.due_at) then raise exception 'Only a deadline extension is available after starting';end if;
 if p_start=w.scheduled_start_at and p_due is not distinct from w.due_at then raise exception 'Choose a different time';end if;
 insert into public.work_time_requests(assignment_id,requester_id,proposed_start_at,proposed_due_at,reason) values(w.id,auth.uid(),p_start,p_due,btrim(p_reason));
 insert into public.work_timeline(assignment_id,actor_id,event,note,scheduled_start_at,due_at) values(w.id,auth.uid(),'Time change requested',btrim(p_reason),p_start,p_due);
 insert into public.notifications(recipient_id,kind,title,href) values(w.employer_id,'work','Your worker requested a schedule change','/dashboard/work/'||w.id);
end;$$;
create function public.review_work_time(p_request uuid,p_approve boolean,p_note text default '') returns void language plpgsql security definer set search_path=public as $$
declare r public.work_time_requests%rowtype;w public.job_assignments%rowtype;
begin
 select * into r from public.work_time_requests where id=p_request;
 select * into w from public.job_assignments where id=r.assignment_id for update;
 select * into r from public.work_time_requests where id=p_request for update;
 if auth.uid() is null or w.id is null or (w.employer_id<>auth.uid() and not public.is_admin()) or r.status<>'pending' or w.state not in ('assigned','in_progress') or p_approve is null or char_length(coalesce(p_note,''))>2000 then raise exception 'Time review unavailable';end if;
 if p_approve then
  if r.proposed_due_at<=now() or (w.state='in_progress' and (r.proposed_start_at is distinct from w.scheduled_start_at or w.due_at is null or r.proposed_due_at is null or r.proposed_due_at<=w.due_at)) then raise exception 'Requested times are no longer valid';end if;
  update public.job_assignments set scheduled_start_at=r.proposed_start_at,due_at=r.proposed_due_at,schedule_accepted_at=now(),updated_at=now() where id=w.id;
 end if;
 update public.work_time_requests set status=case when p_approve then 'approved' else 'rejected' end,decision_note=coalesce(p_note,''),reviewed_by=auth.uid(),reviewed_at=now() where id=r.id;
 insert into public.work_timeline(assignment_id,actor_id,event,note,scheduled_start_at,due_at) values(w.id,auth.uid(),case when p_approve then 'Time change approved' else 'Time change rejected' end,coalesce(p_note,''),r.proposed_start_at,r.proposed_due_at);
 insert into public.notifications(recipient_id,kind,title,href) values(w.worker_id,'work',case when p_approve then 'Your schedule change was approved' else 'Your schedule change was declined' end,'/dashboard/work/'||w.id);
end;$$;
create function public.track_work_timing() returns trigger language plpgsql security definer set search_path=public as $$
begin
 if new.state='in_progress' and old.state='assigned' and new.scheduled_start_at is not null and new.schedule_accepted_at is null then raise exception 'Accept the schedule before starting';end if;
 if new.state is distinct from old.state then
  if new.state='submitted' then new.submitted_at:=now();elsif new.state='in_progress' then new.submitted_at:=null;end if;
  insert into public.work_timeline(assignment_id,actor_id,event,note,scheduled_start_at,due_at) values(new.id,auth.uid(),'Work '||replace(new.state,'_',' '),new.progress_note,new.scheduled_start_at,new.due_at);
  if new.state in ('submitted','completed','cancelled') then
   update public.work_time_requests set status='cancelled',decision_note='Closed after work status changed',reviewed_at=now(),reviewed_by=auth.uid() where assignment_id=new.id and status='pending';
  end if;
 elsif new.progress is distinct from old.progress or new.progress_note is distinct from old.progress_note then
  insert into public.work_timeline(assignment_id,actor_id,event,note,scheduled_start_at,due_at) values(new.id,auth.uid(),'Progress updated ('||new.progress||'%)',new.progress_note,new.scheduled_start_at,new.due_at);
 end if;return new;
end;$$;
create trigger assignments_track_timing before update on public.job_assignments for each row execute function public.track_work_timing();
revoke all on function public.set_work_schedule(uuid,timestamptz,timestamptz,text),public.accept_work_schedule(uuid),public.request_work_time(uuid,timestamptz,timestamptz,text),public.review_work_time(uuid,boolean,text),public.track_work_timing() from public;
grant execute on function public.set_work_schedule(uuid,timestamptz,timestamptz,text),public.accept_work_schedule(uuid),public.request_work_time(uuid,timestamptz,timestamptz,text),public.review_work_time(uuid,boolean,text) to authenticated;
-- Existing assignments retain their state and have no invented deadlines.
commit;
