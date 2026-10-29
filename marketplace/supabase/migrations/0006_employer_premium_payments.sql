-- Manual employer Premium payments with private proof uploads and admin review.

alter table public.profiles
  add column if not exists employer_premium_until timestamptz;

grant select (employer_premium_until) on public.profiles to authenticated;
grant update (employer_premium_until) on public.profiles to authenticated;

create or replace function public.has_active_employer_premium()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where id = (select auth.uid())
      and role = 'employer'
      and employer_premium_until > now()
  );
$$;

grant execute on function public.has_active_employer_premium() to authenticated;

drop policy if exists "Employers create their own job listings" on public.jobs;
create policy "Premium employers create their own job listings"
  on public.jobs for insert to authenticated
  with check (
    employer_id = (select auth.uid())
    and public.current_account_role() = 'employer'
    and public.has_active_employer_premium()
    and status in ('draft', 'pending_review')
  );

drop policy if exists "Employers update their own job listings" on public.jobs;
create policy "Premium employers update their own job listings"
  on public.jobs for update to authenticated
  using (
    employer_id = (select auth.uid())
    and public.current_account_role() = 'employer'
    and (public.has_active_employer_premium() or status = 'published')
  )
  with check (
    employer_id = (select auth.uid())
    and public.current_account_role() = 'employer'
    and (public.has_active_employer_premium() or status = 'closed')
  );

drop policy if exists "Applicants and employers can view relevant applications" on public.applications;
create policy "Applicants, Premium employers, and admins view relevant applications"
  on public.applications for select to authenticated
  using (
    applicant_id = (select auth.uid())
    or public.is_admin()
    or (
      public.has_active_employer_premium()
      and exists (
        select 1 from public.jobs j
        where j.id = applications.job_id and j.employer_id = (select auth.uid())
      )
    )
  );

drop policy if exists "Employers update applications for their own jobs" on public.applications;
create policy "Premium employers update applications for their own jobs"
  on public.applications for update to authenticated
  using (
    public.has_active_employer_premium()
    and exists (select 1 from public.jobs j where j.id = applications.job_id and j.employer_id = (select auth.uid()))
  )
  with check (
    public.has_active_employer_premium()
    and exists (select 1 from public.jobs j where j.id = applications.job_id and j.employer_id = (select auth.uid()))
  );

create or replace function public.protect_employer_premium_access()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
begin
  if old.employer_premium_until is distinct from new.employer_premium_until
     and coalesce((select auth.role()), '') <> 'service_role'
     and not public.is_admin() then
    raise exception 'Only an administrator can change employer Premium access';
  end if;
  return new;
end;
$$;

drop trigger if exists profiles_employer_premium_protected on public.profiles;
create trigger profiles_employer_premium_protected
  before update on public.profiles
  for each row execute procedure public.protect_employer_premium_access();

create table if not exists public.employer_payment_settings (
  id smallint primary key default 1 check (id = 1),
  premium_price_npr integer not null default 0 check (premium_price_npr >= 0),
  premium_duration_days integer not null default 30 check (premium_duration_days between 1 and 365),
  payment_instructions text not null default '' check (char_length(payment_instructions) <= 1500),
  esewa_account_name text not null default '' check (char_length(esewa_account_name) <= 120),
  esewa_account_id text not null default '' check (char_length(esewa_account_id) <= 120),
  khalti_account_name text not null default '' check (char_length(khalti_account_name) <= 120),
  khalti_account_id text not null default '' check (char_length(khalti_account_id) <= 120),
  khalti_payment_url text not null default '' check (char_length(khalti_payment_url) <= 500),
  bank_name text not null default '' check (char_length(bank_name) <= 120),
  bank_account_name text not null default '' check (char_length(bank_account_name) <= 120),
  bank_account_number text not null default '' check (char_length(bank_account_number) <= 120),
  updated_at timestamptz not null default now()
);

insert into public.employer_payment_settings (id)
values (1)
on conflict (id) do nothing;

alter table public.employer_payment_settings enable row level security;
grant select on public.employer_payment_settings to authenticated;
grant insert, update on public.employer_payment_settings to authenticated;

drop policy if exists "Members can view employer payment instructions" on public.employer_payment_settings;
create policy "Members can view employer payment instructions"
  on public.employer_payment_settings for select to authenticated
  using (true);

drop policy if exists "Admins manage employer payment settings" on public.employer_payment_settings;
create policy "Admins manage employer payment settings"
  on public.employer_payment_settings for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

create table if not exists public.employer_payment_requests (
  id uuid primary key default gen_random_uuid(),
  employer_id uuid not null references public.profiles (id) on delete cascade,
  payment_method text not null check (payment_method in ('esewa', 'khalti', 'bank')),
  transaction_code text not null check (char_length(transaction_code) between 4 and 120),
  amount_npr integer not null check (amount_npr > 0),
  plan_duration_days integer not null check (plan_duration_days between 1 and 365),
  proof_path text not null check (char_length(proof_path) between 1 and 300),
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  review_note text not null default '' check (char_length(review_note) <= 1000),
  reviewed_by uuid references public.profiles (id) on delete set null,
  reviewed_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists employer_payment_requests_status_created_idx
  on public.employer_payment_requests (status, created_at desc);
create index if not exists employer_payment_requests_employer_created_idx
  on public.employer_payment_requests (employer_id, created_at desc);
create unique index if not exists employer_payment_requests_one_pending_per_employer
  on public.employer_payment_requests (employer_id) where status = 'pending';
create unique index if not exists employer_payment_requests_unique_active_transaction
  on public.employer_payment_requests (lower(transaction_code)) where status in ('pending', 'approved');

alter table public.employer_payment_requests enable row level security;
grant select, insert on public.employer_payment_requests to authenticated;
grant update (status, review_note, reviewed_by, reviewed_at) on public.employer_payment_requests to authenticated;

drop policy if exists "Employers submit payment proof" on public.employer_payment_requests;
create policy "Employers submit payment proof"
  on public.employer_payment_requests for insert to authenticated
  with check (
    employer_id = (select auth.uid())
    and public.current_account_role() = 'employer'
    and status = 'pending'
    and review_note = ''
    and reviewed_by is null
    and reviewed_at is null
    and (storage.foldername(proof_path))[1] = (select auth.uid())::text
    and exists (
      select 1 from public.employer_payment_settings s
      where s.id = 1
        and s.premium_price_npr > 0
        and s.premium_duration_days = plan_duration_days
        and s.premium_price_npr = amount_npr
        and (
          (payment_method = 'esewa' and s.esewa_account_id <> '')
          or (payment_method = 'khalti' and (s.khalti_account_id <> '' or s.khalti_payment_url <> ''))
          or (payment_method = 'bank' and s.bank_name <> '' and s.bank_account_number <> '')
        )
    )
  );

drop policy if exists "Employers and admins view payment requests" on public.employer_payment_requests;
create policy "Employers and admins view payment requests"
  on public.employer_payment_requests for select to authenticated
  using (employer_id = (select auth.uid()) or public.is_admin());

drop policy if exists "Admins review employer payment requests" on public.employer_payment_requests;
create policy "Admins review employer payment requests"
  on public.employer_payment_requests for update to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- Proof files are private. Employers can upload into their own folder; only
-- the owner and administrators can read a proof (admins use short-lived links).
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'employer-payment-proofs',
  'employer-payment-proofs',
  false,
  5242880,
  array['image/jpeg', 'image/png', 'image/webp', 'application/pdf']
)
on conflict (id) do update set
  public = false,
  file_size_limit = 5242880,
  allowed_mime_types = array['image/jpeg', 'image/png', 'image/webp', 'application/pdf'];

drop policy if exists "Employers upload own payment proof" on storage.objects;
create policy "Employers upload own payment proof"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'employer-payment-proofs'
    and (storage.foldername(name))[1] = (select auth.uid())::text
    and public.current_account_role() = 'employer'
  );

drop policy if exists "Employers and admins read payment proofs" on storage.objects;
create policy "Employers and admins read payment proofs"
  on storage.objects for select to authenticated
  using (
    bucket_id = 'employer-payment-proofs'
    and ((storage.foldername(name))[1] = (select auth.uid())::text or public.is_admin())
  );

drop policy if exists "Employers clean up unlinked payment proofs" on storage.objects;
create policy "Employers clean up unlinked payment proofs"
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'employer-payment-proofs'
    and (storage.foldername(name))[1] = (select auth.uid())::text
    and not exists (
      select 1 from public.employer_payment_requests r
      where r.proof_path = storage.objects.name
    )
  );

-- Approval and entitlement extension happen in one transaction.
create or replace function public.approve_employer_payment_request(p_request_id uuid, p_review_note text default '')
returns timestamptz
language plpgsql
security definer
set search_path = public
as $$
declare
  payment_request public.employer_payment_requests%rowtype;
  premium_until timestamptz;
begin
  if not public.is_admin() then
    raise exception 'Only an administrator can approve employer payments';
  end if;

  select * into payment_request
  from public.employer_payment_requests
  where id = p_request_id
  for update;

  if not found or payment_request.status <> 'pending' then
    raise exception 'This payment request is no longer waiting for review';
  end if;

  update public.profiles
    set employer_premium_until = greatest(coalesce(employer_premium_until, now()), now()) + make_interval(days => payment_request.plan_duration_days)
    where id = payment_request.employer_id and role = 'employer'
    returning employer_premium_until into premium_until;

  if premium_until is null then
    raise exception 'The employer account no longer exists';
  end if;

  update public.employer_payment_requests
    set status = 'approved', review_note = left(coalesce(p_review_note, ''), 1000), reviewed_by = auth.uid(), reviewed_at = now()
    where id = p_request_id;

  return premium_until;
end;
$$;

revoke all on function public.approve_employer_payment_request(uuid, text) from public;
grant execute on function public.approve_employer_payment_request(uuid, text) to authenticated;

-- Direct admin controls can grant or revoke Premium without altering payment
-- records. Member updates are blocked by the profile trigger above.
drop policy if exists "Admins update employer review status" on public.profiles;
create policy "Admins update employer review status"
  on public.profiles for update to authenticated
  using (public.is_admin())
  with check (public.is_admin());

