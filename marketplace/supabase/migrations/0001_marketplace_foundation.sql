-- Titonova marketplace foundation: account roles, jobs, applications, and row-level security.
create type public.account_role as enum ('freelancer', 'employer', 'admin');
create type public.job_status as enum ('draft', 'pending_review', 'published', 'closed', 'rejected');
create type public.application_status as enum ('submitted', 'shortlisted', 'rejected', 'withdrawn');

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  full_name text not null default '',
  company_name text not null default '',
  role public.account_role not null default 'freelancer',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where id = (select auth.uid()) and role = 'admin'
  );
$$;

create or replace function public.current_account_role()
returns public.account_role
language sql
stable
security definer
set search_path = public
as $$
  select role from public.profiles where id = (select auth.uid()) limit 1;
$$;

create or replace function public.create_profile_for_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  requested_role text := new.raw_user_meta_data ->> 'account_type';
  safe_role public.account_role := 'freelancer';
begin
  if requested_role = 'employer' then
    safe_role := 'employer';
  end if;

  insert into public.profiles (id, full_name, company_name, role)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'full_name', ''),
    coalesce(new.raw_user_meta_data ->> 'company_name', ''),
    safe_role
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.create_profile_for_new_user();

create or replace function public.prevent_self_role_change()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
begin
  if old.role is distinct from new.role
     and (select auth.uid()) is not null
     and coalesce((select auth.role()), '') <> 'service_role'
     and not public.is_admin() then
    raise exception 'Account roles cannot be changed by the account owner';
  end if;
  return new;
end;
$$;

create trigger profiles_role_is_protected
  before update on public.profiles
  for each row execute procedure public.prevent_self_role_change();

create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger profiles_set_updated_at
  before update on public.profiles
  for each row execute procedure public.set_updated_at();

create table public.jobs (
  id uuid primary key default gen_random_uuid(),
  employer_id uuid not null references public.profiles (id) on delete cascade,
  title text not null check (char_length(title) between 4 and 120),
  description text not null check (char_length(description) between 30 and 12000),
  category text not null check (char_length(category) between 2 and 80),
  location text not null default 'Remote' check (char_length(location) <= 120),
  work_type text not null default 'contract' check (work_type in ('full_time', 'part_time', 'contract', 'freelance')),
  currency text not null default 'NPR' check (currency in ('NPR', 'USD')),
  pay_min integer check (pay_min is null or pay_min >= 0),
  pay_max integer check (pay_max is null or pay_max >= 0),
  status public.job_status not null default 'pending_review',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint jobs_pay_range_valid check (pay_min is null or pay_max is null or pay_max >= pay_min)
);

create index jobs_public_search_idx on public.jobs (status, created_at desc);
create index jobs_employer_idx on public.jobs (employer_id, created_at desc);
create trigger jobs_set_updated_at
  before update on public.jobs
  for each row execute procedure public.set_updated_at();

create or replace function public.protect_job_ownership_and_review_status()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
begin
  if (select auth.uid()) is not null
     and coalesce((select auth.role()), '') <> 'service_role'
     and not public.is_admin() then
    if old.employer_id is distinct from new.employer_id then
      raise exception 'Job ownership cannot be changed';
    end if;
    if new.status in ('published', 'rejected') and old.status is distinct from new.status then
      raise exception 'Only an administrator can approve or reject a job';
    end if;
  end if;
  return new;
end;
$$;

create trigger jobs_protect_owner_and_review_status
  before update on public.jobs
  for each row execute procedure public.protect_job_ownership_and_review_status();

create table public.applications (
  id uuid primary key default gen_random_uuid(),
  job_id uuid not null references public.jobs (id) on delete cascade,
  applicant_id uuid not null references public.profiles (id) on delete cascade,
  cover_note text not null check (char_length(cover_note) between 20 and 5000),
  status public.application_status not null default 'submitted',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (job_id, applicant_id)
);

create index applications_job_idx on public.applications (job_id, created_at desc);
create index applications_applicant_idx on public.applications (applicant_id, created_at desc);
create trigger applications_set_updated_at
  before update on public.applications
  for each row execute procedure public.set_updated_at();

create or replace function public.protect_application_details()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
begin
  if (select auth.uid()) is not null
     and coalesce((select auth.role()), '') <> 'service_role'
     and not public.is_admin()
     and (old.job_id is distinct from new.job_id
       or old.applicant_id is distinct from new.applicant_id
       or old.cover_note is distinct from new.cover_note) then
    raise exception 'Application details cannot be changed after submission';
  end if;
  return new;
end;
$$;

create trigger applications_protect_submitted_details
  before update on public.applications
  for each row execute procedure public.protect_application_details();

alter table public.profiles enable row level security;
alter table public.jobs enable row level security;
alter table public.applications enable row level security;

create policy "Profiles have public display names"
  on public.profiles for select using (true);
create policy "Members update their own profile fields"
  on public.profiles for update to authenticated
  using (id = (select auth.uid()))
  with check (id = (select auth.uid()));

create policy "Published jobs are public; owners see their own"
  on public.jobs for select
  using (status = 'published' or employer_id = (select auth.uid()) or public.is_admin());
create policy "Employers create their own job listings"
  on public.jobs for insert to authenticated
  with check (
    employer_id = (select auth.uid())
    and public.current_account_role() = 'employer'
    and status in ('draft', 'pending_review')
  );
create policy "Employers update their own job listings"
  on public.jobs for update to authenticated
  using (employer_id = (select auth.uid()) and public.current_account_role() = 'employer')
  with check (
    employer_id = (select auth.uid())
    and public.current_account_role() = 'employer'
    and status in ('draft', 'pending_review', 'closed')
  );
create policy "Employers delete their own unpublished listings"
  on public.jobs for delete to authenticated
  using (
    employer_id = (select auth.uid())
    and public.current_account_role() = 'employer'
    and status in ('draft', 'pending_review', 'rejected')
  );
create policy "Admins manage all job listings"
  on public.jobs for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

create policy "Applicants and employers can view relevant applications"
  on public.applications for select to authenticated
  using (
    applicant_id = (select auth.uid())
    or exists (
      select 1 from public.jobs j
      where j.id = applications.job_id and j.employer_id = (select auth.uid())
    )
    or public.is_admin()
  );
create policy "Freelancers apply to published jobs"
  on public.applications for insert to authenticated
  with check (
    applicant_id = (select auth.uid())
    and public.current_account_role() = 'freelancer'
    and exists (
      select 1 from public.jobs j
      where j.id = applications.job_id and j.status = 'published'
    )
  );
create policy "Applicants withdraw their own applications"
  on public.applications for update to authenticated
  using (applicant_id = (select auth.uid()))
  with check (applicant_id = (select auth.uid()) and status = 'withdrawn');
create policy "Employers update applications for their own jobs"
  on public.applications for update to authenticated
  using (
    exists (select 1 from public.jobs j where j.id = applications.job_id and j.employer_id = (select auth.uid()))
  )
  with check (
    exists (select 1 from public.jobs j where j.id = applications.job_id and j.employer_id = (select auth.uid()))
  );
create policy "Admins manage all applications"
  on public.applications for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());
