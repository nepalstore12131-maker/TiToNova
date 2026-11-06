alter table public.jobs
  add column remote_scope text check (remote_scope in ('worldwide','regions')),
  add column eligible_regions text not null default '' check (length(eligible_regions) <= 180),
  add column required_timezone text not null default '' check (length(required_timezone) <= 80),
  add constraint jobs_remote_eligibility check (
    (remote_scope is null and eligible_regions = '') or
    (work_mode = 'remote' and remote_scope is not null and
      ((remote_scope = 'worldwide' and eligible_regions = '') or
       (remote_scope = 'regions' and btrim(eligible_regions) <> '')))
  );
