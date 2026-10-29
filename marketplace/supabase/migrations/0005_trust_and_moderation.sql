-- Trust signals and member-submitted reports for marketplace moderation.

alter table public.profiles
  add column if not exists employer_verified boolean not null default false,
  add column if not exists employer_verified_at timestamptz;

alter table public.profiles
  drop constraint if exists profiles_verified_role_check;
alter table public.profiles
  add constraint profiles_verified_role_check
  check (role = 'employer' or employer_verified = false);

create or replace function public.protect_employer_verification()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
begin
  if old.employer_verified is distinct from new.employer_verified
     or old.employer_verified_at is distinct from new.employer_verified_at then
    if coalesce((select auth.role()), '') <> 'service_role'
       and not public.is_admin() then
      raise exception 'Only an administrator can review an employer';
    end if;
  end if;

  if new.employer_verified and not old.employer_verified then
    new.employer_verified_at := now();
  elsif not new.employer_verified then
    new.employer_verified_at := null;
  end if;
  if new.role <> 'employer' then
    new.employer_verified := false;
    new.employer_verified_at := null;
  end if;
  return new;
end;
$$;

drop trigger if exists profiles_employer_verification_protected on public.profiles;
create trigger profiles_employer_verification_protected
  before update on public.profiles
  for each row execute procedure public.protect_employer_verification();

-- Public job cards can read this one trust signal for an employer with a
-- published job. The rest of the profile remains protected by the existing RLS.
grant select (employer_verified) on public.profiles to anon;
grant update (employer_verified, employer_verified_at) on public.profiles to authenticated;

drop policy if exists "Admins update employer review status" on public.profiles;
create policy "Admins update employer review status"
  on public.profiles for update to authenticated
  using (public.is_admin())
  with check (public.is_admin());

create table if not exists public.job_reports (
  id uuid primary key default gen_random_uuid(),
  job_id uuid not null references public.jobs (id) on delete cascade,
  reporter_id uuid not null references public.profiles (id) on delete cascade,
  reason text not null check (reason in ('misleading', 'spam', 'suspicious', 'inappropriate', 'other')),
  details text not null default '' check (char_length(details) <= 1500),
  status text not null default 'open' check (status in ('open', 'resolved', 'dismissed')),
  reviewed_by uuid references public.profiles (id) on delete set null,
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  unique (job_id, reporter_id)
);

create index if not exists job_reports_status_created_idx
  on public.job_reports (status, created_at desc);

alter table public.job_reports enable row level security;

grant select, insert on public.job_reports to authenticated;
grant update (status, reviewed_by, reviewed_at) on public.job_reports to authenticated;

drop policy if exists "Members report published jobs" on public.job_reports;
create policy "Members report published jobs"
  on public.job_reports for insert to authenticated
  with check (
    reporter_id = (select auth.uid())
    and exists (
      select 1 from public.jobs j
      where j.id = job_id
        and j.status = 'published'
        and j.employer_id <> (select auth.uid())
    )
  );

drop policy if exists "Reporters and admins can view reports" on public.job_reports;
create policy "Reporters and admins can view reports"
  on public.job_reports for select to authenticated
  using (reporter_id = (select auth.uid()) or public.is_admin());

drop policy if exists "Admins review job reports" on public.job_reports;
create policy "Admins review job reports"
  on public.job_reports for update to authenticated
  using (public.is_admin())
  with check (public.is_admin());
