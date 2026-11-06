alter table public.profiles
  add column work_interests text[] not null default '{}',
  add column preferred_work_modes text[] not null default '{}'
    check (preferred_work_modes <@ array['onsite','remote','hybrid']);
grant update (work_interests, preferred_work_modes) on public.profiles to authenticated;

-- Extend the existing signup trigger, retaining its restricted role selection.
create or replace function public.create_profile_for_new_user()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  meta jsonb := new.raw_user_meta_data;
  member_role public.account_role := 'freelancer';
  interests text[] := '{}';
  modes text[] := '{}';
  introduction text := '';
begin
  if meta->>'account_type' = 'employer' then
    member_role := 'employer';
  else
    introduction := left(trim(coalesce(meta->>'bio','')), 3000);
    if jsonb_typeof(meta->'work_interests') = 'array' then
      select array(select distinct name from public.job_categories
        where active and (meta->'work_interests') ? name) into interests;
    end if;
    if jsonb_typeof(meta->'preferred_work_modes') = 'array' then
      select array(select unnest from unnest(array['onsite','remote','hybrid'])
        where (meta->'preferred_work_modes') ? unnest) into modes;
    end if;
  end if;
  insert into public.profiles(id,full_name,company_name,role,bio,work_interests,preferred_work_modes)
  values(new.id,coalesce(meta->>'full_name',''),coalesce(meta->>'company_name',''),
    member_role,introduction,interests,modes)
  on conflict(id) do nothing;
  return new;
end;
$$;

-- Keep the published-job visibility rules and the existing public rating definition.
create view public.worker_job_discovery with (security_invoker = true) as
select j.*, (j.category = any(me.work_interests)) as interest_match,
  (j.work_mode = any(me.preferred_work_modes)) as mode_match,
  (select r.average_rating from public.rating_summary(j.employer_id) r) as employer_rating,
  e.full_name, e.company_name, e.employer_verified
from public.job_discovery j
join public.profiles me on me.id = (select auth.uid()) and me.role = 'freelancer'
left join public.profiles e on e.id = j.employer_id
where j.status = 'published';
grant select on public.worker_job_discovery to authenticated;
