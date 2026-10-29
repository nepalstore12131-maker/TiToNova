-- Allow the trusted server-side admin client to manage profile rows.
-- The service_role key stays server-only and bypasses row-level security;
-- grants are still required before that role can read or write a table.
grant usage on schema public to service_role;
grant usage on type public.account_role to service_role;
grant select, insert, update, delete on table public.profiles to service_role;
