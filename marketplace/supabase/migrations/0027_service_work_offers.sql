begin;
create table public.service_work_offers (
 id uuid primary key default gen_random_uuid(),request_id uuid not null references public.service_requests(id),revision integer not null,
 title text not null check(char_length(btrim(title)) between 4 and 120),scope text not null check(char_length(btrim(scope)) between 30 and 6000),
 amount integer not null check(amount between 1 and 100000000),basis text not null check(basis in('project','hour','day','month')),
 method text not null check(method in('cash','bank','esewa','khalti','other')),payment_terms text not null check(char_length(btrim(payment_terms)) between 5 and 2000),
 time_arrangement text not null check(char_length(btrim(time_arrangement)) between 3 and 1000),start_at timestamptz,due_at timestamptz,
 status text not null default 'proposed' check(status in('proposed','accepted','declined','withdrawn','superseded')),
 assignment_id uuid references public.job_assignments(id),created_at timestamptz not null default now(),responded_at timestamptz,
 unique(request_id,revision),check(due_at is null or (start_at is not null and due_at>start_at))
);
create unique index one_accepted_service_offer on public.service_work_offers(request_id) where status='accepted';
alter table public.service_work_offers enable row level security;
revoke all on public.service_work_offers from public,anon,authenticated;grant select on public.service_work_offers to authenticated;
create policy "Service parties read offers" on public.service_work_offers for select to authenticated using(exists(select 1 from public.service_requests r where r.id=request_id and (r.worker_id=auth.uid() or r.employer_id=auth.uid() or public.is_admin())));
alter table public.jobs add column service_offer_id uuid unique references public.service_work_offers(id);
-- A private accepted offer must never become a public listing, even through admin publishing.
create function public.guard_service_job() returns trigger language plpgsql security definer set search_path=public as $$
begin
 if tg_op='UPDATE' and new.service_offer_id is distinct from old.service_offer_id then raise exception 'Service origin cannot change';end if;
 if new.service_offer_id is not null then
  if new.status not in('draft','closed') then raise exception 'Service work remains private';end if;
  if tg_op='INSERT' and not exists(select 1 from public.service_work_offers o join public.service_requests r on r.id=o.request_id where o.id=new.service_offer_id and o.status='accepted' and r.worker_id=auth.uid() and r.employer_id=new.employer_id and o.assignment_id is null) then raise exception 'Accepted service offer required';end if;
 end if;return new;
end;$$;
create trigger jobs_service_origin before insert or update on public.jobs for each row execute function public.guard_service_job();
create policy "Service work never public" on public.jobs as restrictive for select using(service_offer_id is null or employer_id=auth.uid() or public.is_admin() or public.is_assigned_job_worker(id));
create or replace function public.guard_work_application() returns trigger language plpgsql security definer set search_path=public as $$
declare j public.jobs%rowtype;
begin
 if tg_op='INSERT' then
  select * into j from public.jobs where id=new.job_id for update;
  if j.service_offer_id is not null and j.status='draft' and new.applicant_id=auth.uid() and exists(select 1 from public.service_work_offers o join public.service_requests r on r.id=o.request_id where o.id=j.service_offer_id and o.status='accepted' and o.assignment_id is null and r.worker_id=auth.uid() and r.employer_id=j.employer_id) then return new;end if;
  if j.id is null or j.status<>'published' or j.archived_at is not null or public.job_filled_seats(j.id)>=j.worker_count then raise exception 'This job no longer accepts applications';end if;
 elsif new.status in('withdrawn','rejected') and exists(select 1 from public.job_assignments where application_id=old.id and state<>'cancelled') then raise exception 'Assigned work must be managed in My work';end if;return new;
end;$$;

create function public.propose_service_work(p_request uuid,p_previous uuid,p_title text,p_scope text,p_amount integer,p_basis text,p_method text,p_terms text,p_time text,p_start timestamptz,p_due timestamptz) returns uuid language plpgsql security definer set search_path=public as $$
declare r public.service_requests%rowtype;o public.service_work_offers%rowtype;result uuid;
begin
 select * into r from public.service_requests where id=p_request for update;
 if auth.uid() is null or r.id is null or r.employer_id<>auth.uid() or r.status not in('open','discussing') or not public.has_active_employer_premium() or public.account_is_suspended(auth.uid()) or public.account_is_suspended(r.worker_id) then raise exception 'Active Premium hirer and open request required';end if;
 select * into o from public.service_work_offers where request_id=r.id order by revision desc limit 1;
 if o.id is distinct from p_previous or o.status='accepted' then raise exception 'Offer changed or already accepted';end if;
 if p_start<now() or p_start>now()+interval '2 years' or p_due>now()+interval '3 years' then raise exception 'Choose future times';end if;
 update public.service_work_offers set status='superseded',responded_at=now() where request_id=r.id and status='proposed';
 insert into public.service_work_offers(request_id,revision,title,scope,amount,basis,method,payment_terms,time_arrangement,start_at,due_at) values(r.id,coalesce(o.revision,0)+1,btrim(p_title),btrim(p_scope),p_amount,p_basis,p_method,btrim(p_terms),btrim(p_time),p_start,p_due) returning id into result;
 insert into public.notifications(recipient_id,kind,title,href) values(r.worker_id,'service','Review a work proposal for your service','/dashboard/service-requests/'||r.id);return result;
end;$$;
create function public.respond_service_work(p_offer uuid,p_action text) returns uuid language plpgsql security definer set search_path=public as $$
declare o public.service_work_offers%rowtype;r public.service_requests%rowtype;s public.worker_services%rowtype;j uuid;a uuid;w uuid;latest uuid;
begin
 select * into o from public.service_work_offers where id=p_offer;
 select * into r from public.service_requests where id=o.request_id for update;
 select * into o from public.service_work_offers where id=p_offer for update;
 if auth.uid() is null or r.id is null then raise exception 'Offer unavailable';end if;
 if p_action='accept' and r.worker_id=auth.uid() and o.status='accepted' then return o.assignment_id;end if;
 select id into latest from public.service_work_offers where request_id=r.id order by revision desc limit 1;
 if latest is distinct from o.id or o.status<>'proposed' or r.status not in('open','discussing') then raise exception 'Offer no longer available';end if;
 if p_action='withdraw' and r.employer_id=auth.uid() then update public.service_work_offers set status='withdrawn',responded_at=now() where id=o.id;return null;end if;
 if r.worker_id<>auth.uid() or p_action not in('accept','decline') then raise exception 'Only the named worker can respond';end if;
 if p_action='decline' then update public.service_work_offers set status='declined',responded_at=now() where id=o.id;
 else
  if public.account_is_suspended(auth.uid()) or public.account_is_suspended(r.employer_id) or not exists(select 1 from public.profiles where id=r.employer_id and role='employer' and employer_premium_until>now()) then raise exception 'Hirer Premium or account access unavailable';end if;
  if o.start_at<now() or o.due_at<now() then raise exception 'Ask for a current schedule';end if;
  select * into s from public.worker_services where id=r.service_id;
  update public.service_work_offers set status='accepted',responded_at=now() where id=o.id;
  insert into public.jobs(employer_id,title,description,category,location,pay_min,pay_max,pay_period,status,service_offer_id) values(r.employer_id,o.title,o.scope,s.category,s.location,o.amount,o.amount,case when o.basis='day' then 'unspecified' else o.basis end,'draft',o.id) returning id into j;
  insert into public.applications(job_id,applicant_id,cover_note,status,hiring_stage) values(j,r.worker_id,'I accepted the private service work proposal.','shortlisted','hired') returning id into a;
  insert into public.job_assignments(job_id,application_id,employer_id,worker_id,scheduled_start_at,due_at,schedule_accepted_at) values(j,a,r.employer_id,r.worker_id,o.start_at,o.due_at,case when o.start_at is not null then now() end) returning id into w;
  insert into public.work_agreements(assignment_id,revision,proposed_by,scope,amount,pay_basis,payment_method,payment_terms,time_arrangement,scheduled_start_at,due_at,status,accepted_by,accepted_at,responded_at) values(w,1,r.employer_id,o.scope,o.amount,o.basis,o.method,o.payment_terms,o.time_arrangement,o.start_at,o.due_at,'accepted',r.worker_id,now(),now());
  update public.jobs set status='closed' where id=j;
  update public.service_work_offers set assignment_id=w where id=o.id;
  insert into public.work_timeline(assignment_id,actor_id,event,note) values(w,auth.uid(),'Service proposal accepted','Work has not started. Open My work when ready to start.');
 end if;
 insert into public.notifications(recipient_id,kind,title,href) values(r.employer_id,'service','Your service work proposal has a response','/dashboard/service-requests/'||r.id);return w;
end;$$;
revoke all on function public.guard_service_job(),public.propose_service_work(uuid,uuid,text,text,integer,text,text,text,text,timestamptz,timestamptz),public.respond_service_work(uuid,text) from public;
grant execute on function public.propose_service_work(uuid,uuid,text,text,integer,text,text,text,text,timestamptz,timestamptz),public.respond_service_work(uuid,text) to authenticated;
commit;
