begin;
create table public.worker_services (
 id uuid primary key default gen_random_uuid(),worker_id uuid not null references public.profiles(id),
 display_name text not null check(char_length(btrim(display_name)) between 2 and 80),title text not null check(char_length(btrim(title)) between 4 and 120),
 description text not null check(char_length(btrim(description)) between 30 and 6000),category text not null check(char_length(category) between 2 and 80),location text not null check(char_length(location) between 2 and 120),
 starting_price integer not null check(starting_price between 1 and 100000000),price_unit text not null check(price_unit in('hour','day','project')),sample_links text not null default '' check(char_length(sample_links)<=3000),
 status text not null default 'pending' check(status in('pending','published','paused','rejected')),review_note text not null default '' check(char_length(review_note)<=1000),created_at timestamptz not null default now(),updated_at timestamptz not null default now()
);
create unique index worker_service_unique_title on public.worker_services(worker_id,lower(title));
alter table public.worker_services enable row level security;
revoke all on public.worker_services from public,anon,authenticated;
grant select on public.worker_services to anon,authenticated;
create policy "Public approved services and private owner drafts" on public.worker_services for select using((status='published' and not public.account_is_suspended(worker_id)) or worker_id=auth.uid() or public.is_admin());
create function public.save_worker_service(p_id uuid,p_name text,p_title text,p_description text,p_category text,p_location text,p_price integer,p_unit text,p_samples text,p_pause boolean default false) returns uuid language plpgsql security definer set search_path=public as $$
declare result uuid;
begin
 if auth.uid() is null or public.current_account_role()<>'freelancer' or public.account_is_suspended(auth.uid()) then raise exception 'Worker account required';end if;
 if p_id is not null then
  select id into result from public.worker_services where id=p_id and worker_id=auth.uid() for update;
  if result is null then raise exception 'Service unavailable';end if;
  if p_pause then update public.worker_services set status='paused',updated_at=now() where id=result;return result;end if;
 else
  perform pg_advisory_xact_lock(hashtextextended(auth.uid()::text,26));
  if (select count(*) from public.worker_services where worker_id=auth.uid())>=10 then raise exception 'Maximum 10 services';end if;
 end if;
 if not exists(select 1 from public.job_categories where name=p_category and active) then raise exception 'Choose an active category';end if;
 if p_id is null then insert into public.worker_services(worker_id,display_name,title,description,category,location,starting_price,price_unit,sample_links) values(auth.uid(),btrim(p_name),btrim(p_title),btrim(p_description),p_category,btrim(p_location),p_price,p_unit,coalesce(p_samples,'')) returning id into result;
 else update public.worker_services set display_name=btrim(p_name),title=btrim(p_title),description=btrim(p_description),category=p_category,location=btrim(p_location),starting_price=p_price,price_unit=p_unit,sample_links=coalesce(p_samples,''),status='pending',review_note='',updated_at=now() where id=result;end if;
 return result;
end;$$;
create function public.review_worker_service(p_id uuid,p_status text,p_note text) returns void language plpgsql security definer set search_path=public as $$
begin
 if not public.is_admin() or p_status not in('published','rejected','paused') then raise exception 'Admin required';end if;
 update public.worker_services set status=p_status,review_note=coalesce(p_note,''),updated_at=now() where id=p_id;
end;$$;
create table public.service_requests (
 id uuid primary key default gen_random_uuid(),service_id uuid not null references public.worker_services(id),employer_id uuid not null references public.profiles(id),worker_id uuid not null references public.profiles(id),
 details text not null check(char_length(btrim(details)) between 20 and 4000),budget integer check(budget between 1 and 100000000),
 status text not null default 'open' check(status in('open','discussing','declined','closed')),created_at timestamptz not null default now(),updated_at timestamptz not null default now()
);
create unique index one_open_service_request on public.service_requests(service_id,employer_id) where status in('open','discussing');
create table public.service_request_messages(id uuid primary key default gen_random_uuid(),request_id uuid not null references public.service_requests(id),sender_id uuid not null references public.profiles(id),body text not null check(char_length(btrim(body)) between 1 and 4000),created_at timestamptz not null default now());
alter table public.service_requests enable row level security;alter table public.service_request_messages enable row level security;
revoke all on public.service_requests,public.service_request_messages from public,anon,authenticated;
grant select on public.service_requests,public.service_request_messages to authenticated;
create policy "Service request participants" on public.service_requests for select to authenticated using(employer_id=auth.uid() or worker_id=auth.uid() or public.is_admin());
create policy "Service conversation participants" on public.service_request_messages for select to authenticated using(exists(select 1 from public.service_requests r where r.id=request_id and (r.employer_id=auth.uid() or r.worker_id=auth.uid() or public.is_admin())));
create function public.request_worker_service(p_service uuid,p_details text,p_budget integer) returns uuid language plpgsql security definer set search_path=public as $$
declare s public.worker_services%rowtype;result uuid;
begin
 select * into s from public.worker_services where id=p_service for share;
 if auth.uid() is null or public.current_account_role()<>'employer' or s.id is null or s.status<>'published' or public.account_is_suspended(auth.uid()) or public.account_is_suspended(s.worker_id) then raise exception 'Request unavailable';end if;
 perform pg_advisory_xact_lock(hashtextextended(auth.uid()::text,27));
 if (select count(*) from public.service_requests where employer_id=auth.uid() and created_at>now()-interval '1 day')>=10 then raise exception 'Daily request limit reached';end if;
 insert into public.service_requests(service_id,employer_id,worker_id,details,budget) values(s.id,auth.uid(),s.worker_id,btrim(p_details),p_budget) returning id into result;
 insert into public.notifications(recipient_id,kind,title,href) values(s.worker_id,'service','Someone asked about your service','/dashboard/service-requests/'||result);return result;
end;$$;
create function public.respond_service_request(p_id uuid,p_action text,p_body text default '') returns void language plpgsql security definer set search_path=public as $$
declare r public.service_requests%rowtype;target uuid;
begin
 select * into r from public.service_requests where id=p_id for update;
 if auth.uid() is null or r.id is null or (auth.uid() not in(r.worker_id,r.employer_id) and not public.is_admin()) then raise exception 'Request unavailable';end if;
 if p_action='close' then update public.service_requests set status='closed',updated_at=now() where id=r.id;
 elsif p_action='decline' and auth.uid()=r.worker_id and r.status in('open','discussing') then update public.service_requests set status='declined',updated_at=now() where id=r.id;
 elsif p_action='reply' and r.status in('open','discussing') and not public.account_is_suspended(auth.uid()) then
  if (select count(*) from public.service_request_messages where sender_id=auth.uid() and created_at>now()-interval '1 hour')>=30 then raise exception 'Reply limit reached';end if;
  insert into public.service_request_messages(request_id,sender_id,body) values(r.id,auth.uid(),btrim(p_body));update public.service_requests set status='discussing',updated_at=now() where id=r.id;
 else raise exception 'Action unavailable';end if;
 target:=case when auth.uid()=r.worker_id then r.employer_id else r.worker_id end;
 insert into public.notifications(recipient_id,kind,title,href) values(target,'service','Your service request has an update','/dashboard/service-requests/'||r.id);
end;$$;
revoke all on function public.save_worker_service(uuid,text,text,text,text,text,integer,text,text,boolean),public.review_worker_service(uuid,text,text),public.request_worker_service(uuid,text,integer),public.respond_service_request(uuid,text,text) from public;
grant execute on function public.save_worker_service(uuid,text,text,text,text,text,integer,text,text,boolean),public.review_worker_service(uuid,text,text),public.request_worker_service(uuid,text,integer),public.respond_service_request(uuid,text,text) to authenticated;
commit;
