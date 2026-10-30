begin;
-- Existing work is not retroactively blocked. New assignments require agreement.
alter table public.job_assignments add column agreement_required boolean not null default false;
alter table public.job_assignments alter column agreement_required set default true;
create table public.work_agreements(
 id uuid primary key default gen_random_uuid(),assignment_id uuid not null references public.job_assignments(id) on delete restrict,
 revision integer not null check(revision>0),proposed_by uuid not null references public.profiles(id),
 scope text not null check(char_length(btrim(scope)) between 20 and 6000),
 amount numeric(12,2) not null check(amount>0 and amount<=1000000000),currency text not null default 'NPR' check(currency='NPR'),
 pay_basis text not null check(pay_basis in ('project','hour','day','month')),
 payment_method text not null check(payment_method in ('cash','bank','esewa','khalti','other')),
 payment_terms text not null check(char_length(btrim(payment_terms)) between 5 and 2000),
 time_arrangement text not null check(char_length(btrim(time_arrangement)) between 3 and 1000),
 scheduled_start_at timestamptz,due_at timestamptz,
 status text not null default 'proposed' check(status in ('proposed','accepted','changes_requested')),
 change_request text not null default '' check(char_length(change_request)<=2000),
 accepted_by uuid references public.profiles(id),accepted_at timestamptz,responded_at timestamptz,
 created_at timestamptz not null default now(),unique(assignment_id,revision)
);
alter table public.work_agreements enable row level security;
revoke all on public.work_agreements from public,anon,authenticated;
grant select on public.work_agreements to authenticated;
create policy "Participants and admins read work agreements" on public.work_agreements for select to authenticated using(exists(select 1 from public.job_assignments w where w.id=assignment_id and (w.worker_id=auth.uid() or w.employer_id=auth.uid() or public.is_admin())));
create function public.propose_work_agreement(p_assignment uuid,p_previous uuid,p_scope text,p_amount numeric,p_basis text,p_method text,p_payment_terms text,p_time_arrangement text) returns uuid language plpgsql security definer set search_path=public as $$
declare w public.job_assignments%rowtype;a public.work_agreements%rowtype;result uuid;
begin
 select * into w from public.job_assignments where id=p_assignment for update;
 if auth.uid() is null or w.id is null or w.employer_id<>auth.uid() or w.state<>'assigned' then raise exception 'Agreement proposal unavailable';end if;
 select * into a from public.work_agreements where assignment_id=w.id order by revision desc limit 1;
 if a.id is distinct from p_previous then raise exception 'Agreement changed; refresh before proposing';end if;
 if p_scope is null or p_amount is null or p_basis is null or p_method is null or p_payment_terms is null or p_time_arrangement is null then raise exception 'Complete the agreement';end if;
 insert into public.work_agreements(assignment_id,revision,proposed_by,scope,amount,pay_basis,payment_method,payment_terms,time_arrangement,scheduled_start_at,due_at)
 values(w.id,coalesce(a.revision,0)+1,auth.uid(),btrim(p_scope),p_amount,p_basis,p_method,btrim(p_payment_terms),btrim(p_time_arrangement),w.scheduled_start_at,w.due_at) returning id into result;
 update public.job_assignments set agreement_required=true,updated_at=now() where id=w.id;
 insert into public.work_timeline(assignment_id,actor_id,event,note) values(w.id,auth.uid(),'Work agreement proposed','Revision '||(coalesce(a.revision,0)+1));
 insert into public.notifications(recipient_id,kind,title,href) values(w.worker_id,'work','Review the work details and payment terms before starting','/dashboard/work/'||w.id);
 return result;
end;$$;
create function public.respond_work_agreement(p_agreement uuid,p_accept boolean,p_note text default '') returns void language plpgsql security definer set search_path=public as $$
declare w public.job_assignments%rowtype;a public.work_agreements%rowtype;latest uuid;
begin
 select * into a from public.work_agreements where id=p_agreement;
 select * into w from public.job_assignments where id=a.assignment_id for update;
 select * into a from public.work_agreements where id=p_agreement for update;
 select id into latest from public.work_agreements where assignment_id=w.id order by revision desc limit 1;
 if auth.uid() is null or w.id is null or w.worker_id<>auth.uid() or w.state<>'assigned' or latest is distinct from a.id or p_accept is null then raise exception 'Agreement response unavailable';end if;
 if p_accept then
  if a.status<>'proposed' or a.scheduled_start_at is distinct from w.scheduled_start_at or a.due_at is distinct from w.due_at then raise exception 'Agreement changed; ask the hirer for a current proposal';end if;
  update public.work_agreements set status='accepted',accepted_by=auth.uid(),accepted_at=now(),responded_at=now() where id=a.id;
  update public.job_assignments set schedule_accepted_at=case when scheduled_start_at is not null then now() else null end,updated_at=now() where id=w.id;
 else
  if a.status='changes_requested' or char_length(btrim(coalesce(p_note,''))) not between 5 and 2000 then raise exception 'Explain the changes you need';end if;
  update public.work_agreements set status='changes_requested',change_request=btrim(p_note),responded_at=now() where id=a.id;
 end if;
 insert into public.work_timeline(assignment_id,actor_id,event,note) values(w.id,auth.uid(),case when p_accept then 'Work agreement accepted' else 'Agreement changes requested' end,'Revision '||a.revision||case when p_accept then '' else ': '||btrim(p_note) end);
 insert into public.notifications(recipient_id,kind,title,href) values(w.employer_id,'work',case when p_accept then 'Your worker accepted the work agreement' else 'Your worker requested agreement changes' end,'/dashboard/work/'||w.id);
end;$$;
create function public.guard_work_agreement_start() returns trigger language plpgsql security definer set search_path=public as $$
declare a public.work_agreements%rowtype;
begin
 if old.state='assigned' and new.state='in_progress' and new.agreement_required then
  select * into a from public.work_agreements where assignment_id=new.id order by revision desc limit 1;
  if a.id is null or a.status<>'accepted' or a.accepted_by is distinct from new.worker_id or a.scheduled_start_at is distinct from new.scheduled_start_at or a.due_at is distinct from new.due_at then raise exception 'Accept the current work agreement before starting';end if;
 end if;return new;
end;$$;
create trigger assignments_agreement_start before update on public.job_assignments for each row execute function public.guard_work_agreement_start();
revoke all on function public.propose_work_agreement(uuid,uuid,text,numeric,text,text,text,text),public.respond_work_agreement(uuid,boolean,text),public.guard_work_agreement_start() from public;
grant execute on function public.propose_work_agreement(uuid,uuid,text,numeric,text,text,text,text),public.respond_work_agreement(uuid,boolean,text) to authenticated;
commit;
