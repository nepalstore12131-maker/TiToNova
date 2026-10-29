-- Grant only the table operations used by the marketplace API. RLS remains
-- enabled and limits rows by publication status, ownership, and application.

grant usage on schema public to anon, authenticated;

-- Public job cards may show an employer's name, but not a job seeker's profile.
grant select (id, full_name, company_name, role) on public.profiles to anon;
grant select on public.profiles to authenticated;
grant update (full_name, company_name, headline, bio, location, skills, portfolio_url, linkedin_url)
  on public.profiles to authenticated;

drop policy if exists "Profiles have public display names" on public.profiles;
drop policy if exists "Public can view employer names" on public.profiles;
drop policy if exists "Members can view own and relevant profiles" on public.profiles;

create policy "Public can view employer names"
  on public.profiles for select to anon
  using (
    role = 'employer'
    and exists (
      select 1 from public.jobs j
      where j.employer_id = profiles.id and j.status = 'published'
    )
  );

create policy "Members can view own and relevant profiles"
  on public.profiles for select to authenticated
  using (
    id = (select auth.uid())
    or public.is_admin()
    or (
      role = 'employer'
      and exists (
        select 1 from public.jobs j
        where j.employer_id = profiles.id and j.status = 'published'
      )
    )
    or exists (
      select 1
      from public.applications a
      join public.jobs j on j.id = a.job_id
      where a.applicant_id = profiles.id
        and j.employer_id = (select auth.uid())
    )
  );

-- Jobs are public only when the existing RLS policy says they are published.
grant select on public.jobs to anon, authenticated;
grant insert, update, delete on public.jobs to authenticated;

-- Applications remain limited by the existing applicant/employer/admin RLS rules.
grant select, insert, update on public.applications to authenticated;

grant usage on type public.account_role, public.job_status, public.application_status
  to anon, authenticated;
