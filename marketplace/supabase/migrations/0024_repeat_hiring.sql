begin;
create table public.saved_workers(employer_id uuid not null references public.profiles(id),worker_id uuid not null references public.profiles(id),created_at timestamptz not null default now(),primary key(employer_id,worker_id));
create table public.rehire_invitations(
 id uuid primary key default gen_random_uuid(),employer_id uuid not null references public.profiles(id),worker_id uuid not null references public.profiles(id),job_id uuid not null references public.jobs(id),
 note text not null check(char_length(btrim(note)) between 10 and 2000),status text not null default 'pending' check(status in('pending','accepted','declined','cancelled')),
 application_id uuid references public.applications(id),created_at timestamptz not null default now(),responded_at timestamptz,unique(job_id,worker_id)
);
alter table public.saved_workers enable row level security;alter table public.rehire_invitations enable row level security;
revoke all on public.saved_workers,public.rehire_invitations from public,anon,authenticated;
grant select on public.saved_workers,public.rehire_invitations to authenticated;
create policy "Hirer private saved workers" on public.saved_workers for select to authenticated using(employer_id=auth.uid());
create policy "Invitation participants and admins" on public.rehire_invitations for select to authenticated using(employer_id=auth.uid() or worker_id=auth.uid() or public.is_admin());
create function public.save_previous_worker(p_worker uuid,p_save boolean) returns void language plpgsql security definer set search_path=public as $$
begin
 if auth.uid() is null or public.current_account_role()<>'employer' then raise exception 'Hirer required';end if;
 if not p_save then delete from public.saved_workers where employer_id=auth.uid() and worker_id=p_worker;return;end if;
 if p_save is null or public.account_is_suspended(auth.uid()) or not exists(select 1 from public.job_assignments where employer_id=auth.uid() and worker_id=p_worker and state='completed') then raise exception 'Complete a job together before saving this worker';end if;
 insert into public.saved_workers(employer_id,worker_id) values(auth.uid(),p_worker) on conflict do nothing;
end;$$;
create function public.invite_previous_worker(p_worker uuid,p_job uuid,p_note text) returns uuid language plpgsql security definer set search_path=public as $$
declare j public.jobs%rowtype;r uuid;
begin
 select * into j from public.jobs where id=p_job for update;
 if auth.uid() is null or j.id is null or j.employer_id<>auth.uid() or not public.has_active_employer_premium() or public.account_is_suspended(auth.uid()) or public.account_is_suspended(p_worker) then raise exception 'Invitation unavailable';end if;
 if j.status<>'published' or j.archived_at is not null or (j.applications_open_at is not null and j.applications_open_at>now()) or (j.applications_close_at is not null and j.applications_close_at<=now()) or exists(select 1 from public.job_assignments where job_id=j.id and state<>'cancelled') then raise exception 'Choose an open unassigned job';end if;
 if not exists(select 1 from public.job_assignments where employer_id=auth.uid() and worker_id=p_worker and state='completed') then raise exception 'Previous completed work required';end if;
 if exists(select 1 from public.applications where job_id=j.id and applicant_id=p_worker) then raise exception 'This worker already applied; review that application';end if;
 perform pg_advisory_xact_lock(hashtextextended(auth.uid()::text,24));
 if (select count(*) from public.rehire_invitations where employer_id=auth.uid() and created_at>now()-interval '1 day')>=20 then raise exception 'Daily invitation limit reached';end if;
 insert into public.rehire_invitations(employer_id,worker_id,job_id,note) values(auth.uid(),p_worker,j.id,btrim(p_note)) returning id into r;
 insert into public.notifications(recipient_id,kind,title,href) values(p_worker,'hiring','A previous hirer invited you to a new job','/dashboard/invitations');return r;
end;$$;
create function public.respond_rehire_invitation(p_invitation uuid,p_action text) returns void language plpgsql security definer set search_path=public as $$
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
  if public.account_is_suspended(auth.uid()) or public.account_is_suspended(i.employer_id) or j.status<>'published' or j.archived_at is not null or (j.applications_open_at is not null and j.applications_open_at>now()) or (j.applications_close_at is not null and j.applications_close_at<=now()) or exists(select 1 from public.job_assignments where job_id=j.id and state<>'cancelled') then raise exception 'This job is no longer available';end if;
  select id into a from public.applications where job_id=j.id and applicant_id=auth.uid();
  if a is not null and exists(select 1 from public.applications where id=a and status in('withdrawn','rejected')) then raise exception 'Existing application is no longer active';end if;
  if a is null then insert into public.applications(job_id,applicant_id,cover_note) values(j.id,auth.uid(),'I accepted your invitation and would like to discuss this job.') returning id into a;end if;
  update public.rehire_invitations set status='accepted',application_id=a,responded_at=now() where id=i.id;
 end if;
 insert into public.notifications(recipient_id,kind,title,href) values(i.employer_id,'hiring','Your repeat-hiring invitation has a response','/dashboard/invitations');
end;$$;
revoke all on function public.save_previous_worker(uuid,boolean),public.invite_previous_worker(uuid,uuid,text),public.respond_rehire_invitation(uuid,text) from public;
grant execute on function public.save_previous_worker(uuid,boolean),public.invite_previous_worker(uuid,uuid,text),public.respond_rehire_invitation(uuid,text) to authenticated;
commit;
