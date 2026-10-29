begin;
-- Search metadata and private conversations between application participants.
alter table public.jobs add column if not exists work_mode text not null default 'onsite' check (work_mode in ('onsite','hybrid','remote'));
alter table public.jobs add column if not exists pay_period text not null default 'unspecified' check (pay_period in ('unspecified','month','hour','project'));
alter table public.jobs add column if not exists experience_level text not null default 'any' check (experience_level in ('any','entry','mid','senior'));
update public.jobs set work_mode = 'remote' where location ilike '%remote%' and work_mode = 'onsite';
create index if not exists jobs_discovery_idx on public.jobs(status, work_mode, experience_level, created_at desc);
-- Remove the previous pre-Premium update policy, which otherwise combines with
-- the Premium policy using OR and permits an expired employer to review applications.
drop policy if exists "Employers review submitted applications for their own jobs" on public.applications;

create or replace function public.public_company(p_id uuid)
returns table (id uuid, company_name text, full_name text, headline text, bio text, location text, portfolio_url text, employer_verified boolean)
language sql stable security definer set search_path = public as $$
  select p.id,p.company_name,p.full_name,p.headline,p.bio,p.location,p.portfolio_url,p.employer_verified from public.profiles p where p.id=p_id and p.role='employer';
$$;
revoke all on function public.public_company(uuid) from public;
grant execute on function public.public_company(uuid) to anon, authenticated;

create or replace function public.can_read_conversation(p_application uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select auth.uid() is not null and (public.is_admin() or exists (
    select 1 from public.applications a join public.jobs j on j.id=a.job_id
    where a.id=p_application and (a.applicant_id=auth.uid() or (j.employer_id=auth.uid() and public.has_active_employer_premium()))
  ));
$$;
revoke all on function public.can_read_conversation(uuid) from public;
grant execute on function public.can_read_conversation(uuid) to authenticated;

create table if not exists public.conversation_controls (
  application_id uuid primary key references public.applications(id) on delete cascade,
  paused boolean not null default false,
  updated_by uuid references public.profiles(id) on delete set null,
  updated_at timestamptz not null default now()
);
alter table public.conversation_controls enable row level security;
grant select on public.conversation_controls to authenticated;
grant insert, update on public.conversation_controls to authenticated;
create policy "Participants read conversation controls" on public.conversation_controls for select to authenticated using (public.can_read_conversation(application_id));
create policy "Admins moderate conversations" on public.conversation_controls for all to authenticated using (public.is_admin()) with check (public.is_admin());

create table if not exists public.application_messages (
  id uuid primary key default gen_random_uuid(),
  application_id uuid not null references public.applications(id) on delete cascade,
  sender_id uuid not null references public.profiles(id) on delete cascade,
  body text not null check (char_length(btrim(body)) between 1 and 3000),
  hidden boolean not null default false,
  created_at timestamptz not null default now()
);
create index if not exists application_messages_thread_idx on public.application_messages(application_id, created_at desc);
create index if not exists application_messages_sender_idx on public.application_messages(sender_id, created_at desc);
alter table public.application_messages enable row level security;
grant select, insert on public.application_messages to authenticated;
grant update (hidden) on public.application_messages to authenticated;
create policy "Participants read their application messages" on public.application_messages for select to authenticated using (public.can_read_conversation(application_id) and (not hidden or public.is_admin()));
create policy "Participants send application messages" on public.application_messages for insert to authenticated with check (
  sender_id=auth.uid() and hidden=false and public.can_read_conversation(application_id)
  and public.current_account_role() in ('freelancer','employer')
  and exists (select 1 from public.applications a where a.id=application_id and a.status in ('submitted','shortlisted'))
  and not exists (select 1 from public.conversation_controls c where c.application_id=application_messages.application_id and c.paused)
);
create policy "Admins hide inappropriate messages" on public.application_messages for update to authenticated using (public.is_admin()) with check (public.is_admin());

-- Set timestamps on the server and limit message bursts even via direct API calls.
create or replace function public.guard_application_message() returns trigger language plpgsql security definer set search_path=public as $$
begin
  if auth.uid() is null or new.sender_id <> auth.uid() then raise exception 'Sign in to send a message'; end if;
  perform pg_advisory_xact_lock(hashtext(new.sender_id::text));
  if (select count(*) from public.application_messages where sender_id=new.sender_id and created_at > now()-interval '1 minute') >= 10 then
    raise exception 'Please wait a minute before sending more messages';
  end if;
  new.created_at := now(); new.hidden := false;
  return new;
end;
$$;
create trigger application_messages_guard before insert on public.application_messages for each row execute function public.guard_application_message();

create table if not exists public.message_reports (
  id uuid primary key default gen_random_uuid(),
  message_id uuid not null references public.application_messages(id) on delete cascade,
  reporter_id uuid not null references public.profiles(id) on delete cascade,
  reason text not null check (reason in ('spam','harassment','suspicious','other')),
  details text not null default '' check (char_length(details)<=1500),
  status text not null default 'open' check (status in ('open','resolved','dismissed')),
  created_at timestamptz not null default now(),
  unique(message_id,reporter_id)
);
alter table public.message_reports enable row level security;
grant select, insert on public.message_reports to authenticated;
grant update(status) on public.message_reports to authenticated;
create policy "Participants report received messages" on public.message_reports for insert to authenticated with check (
  reporter_id=auth.uid() and status='open' and exists (
    select 1 from public.application_messages m where m.id=message_id and m.sender_id<>auth.uid() and public.can_read_conversation(m.application_id)
  )
);
create policy "Members read own message reports" on public.message_reports for select to authenticated using (reporter_id=auth.uid() or public.is_admin());
create policy "Admins resolve message reports" on public.message_reports for update to authenticated using (public.is_admin()) with check (public.is_admin());

commit;
