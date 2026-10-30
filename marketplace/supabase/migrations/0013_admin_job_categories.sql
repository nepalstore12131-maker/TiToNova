begin;
create table public.job_categories (
 id uuid primary key default gen_random_uuid(),
 name text not null check(char_length(btrim(name)) between 2 and 80 and name=btrim(name)),
 active boolean not null default true,
 sort_order integer not null default 100 check(sort_order between 0 and 9999),
 created_at timestamptz not null default now()
);
create unique index job_categories_unique_name on public.job_categories(lower(name));
alter table public.job_categories enable row level security;
revoke all on public.job_categories from anon, authenticated;
grant select on public.job_categories to anon, authenticated;
grant insert,update on public.job_categories to authenticated;
create policy "Category names are public" on public.job_categories for select using(true);
create policy "Only admins add categories" on public.job_categories for insert to authenticated with check(public.is_admin());
create policy "Only admins edit categories" on public.job_categories for update to authenticated using(public.is_admin()) with check(public.is_admin());
insert into public.job_categories(name,sort_order) values
 ('Home & cleaning',10),('Hotels & restaurants',20),('Shops & retail',30),('Repairs & maintenance',40),('Events & temporary help',50),
 ('Design & creative',60),('Development',70),('Marketing',80),('Writing & content',90),('Business support',100),('Other',110);
-- Existing jobs are deliberately not updated, even when a category is renamed.
create function public.validate_job_category() returns trigger language plpgsql security definer set search_path=public as $$
begin
 if tg_op='UPDATE' then
  if new.category is not distinct from old.category then return new; end if;
 end if;
 if not exists(select 1 from public.job_categories where name=new.category and active) then
  raise exception 'Choose an active job category';
 end if;
 return new;
end;
$$;
revoke all on function public.validate_job_category() from public;
create trigger validate_job_category before insert or update of category on public.jobs for each row execute function public.validate_job_category();
commit;
