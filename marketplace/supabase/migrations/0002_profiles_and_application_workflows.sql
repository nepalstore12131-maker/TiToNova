-- Extend profiles for a useful member page and narrow application state changes.
alter table public.profiles
  add column if not exists headline text not null default '' check (char_length(headline) <= 120),
  add column if not exists bio text not null default '' check (char_length(bio) <= 3000),
  add column if not exists location text not null default '' check (char_length(location) <= 120),
  add column if not exists skills text[] not null default '{}',
  add column if not exists portfolio_url text not null default '' check (char_length(portfolio_url) <= 300),
  add column if not exists linkedin_url text not null default '' check (char_length(linkedin_url) <= 300);

create index if not exists profiles_skills_idx on public.profiles using gin (skills);

drop policy if exists "Applicants withdraw their own applications" on public.applications;
create policy "Applicants withdraw submitted applications"
  on public.applications for update to authenticated
  using (applicant_id = (select auth.uid()) and status = 'submitted')
  with check (applicant_id = (select auth.uid()) and status = 'withdrawn');

drop policy if exists "Employers update applications for their own jobs" on public.applications;
create policy "Employers review submitted applications for their own jobs"
  on public.applications for update to authenticated
  using (
    status = 'submitted'
    and exists (
      select 1 from public.jobs j
      where j.id = applications.job_id
        and j.employer_id = (select auth.uid())
        and public.current_account_role() = 'employer'
    )
  )
  with check (
    status in ('shortlisted', 'rejected')
    and exists (
      select 1 from public.jobs j
      where j.id = applications.job_id
        and j.employer_id = (select auth.uid())
        and public.current_account_role() = 'employer'
    )
  );
