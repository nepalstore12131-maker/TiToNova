begin;
create table public.site_visit_events (
 id uuid primary key, session_id uuid not null,
 page_group text not null check(page_group in ('Home','Jobs','Job details','Services','Service details','Company profile','Signup','Login','Help','Contact','Workspace')),
 source_group text not null check(source_group in ('Direct / unknown','TikTok','Facebook','Instagram','Google','Other website')),
 created_at timestamptz not null default now()
);
alter table public.site_visit_events enable row level security;
revoke all on public.site_visit_events from public,anon,authenticated;
grant select,insert on public.site_visit_events to service_role;
create index site_visit_events_time on public.site_visit_events(created_at);
create index site_visit_events_session_time on public.site_visit_events(session_id,created_at);
create table public.site_traffic_configuration(id boolean primary key default true check(id),started_at timestamptz not null default now());
insert into public.site_traffic_configuration(id) values(true);
alter table public.site_traffic_configuration enable row level security;
revoke all on public.site_traffic_configuration from public,anon,authenticated;
create function public.record_site_visit(p_event uuid,p_session uuid,p_page text,p_source text) returns void language plpgsql security definer set search_path=public as $$
begin
 perform pg_advisory_xact_lock(hashtextextended(p_session::text,928));
 if (select count(*) from public.site_visit_events where session_id=p_session and created_at>=now()-interval '24 hours')>=200 then return;end if;
 insert into public.site_visit_events(id,session_id,page_group,source_group) values(p_event,p_session,p_page,p_source) on conflict(id) do nothing;
end;$$;
revoke all on function public.record_site_visit(uuid,uuid,text,text) from public,anon,authenticated;
grant execute on function public.record_site_visit(uuid,uuid,text,text) to service_role;
create function public.site_traffic_report(p_days integer default 30) returns jsonb language plpgsql security definer set search_path=public as $$
declare ending timestamptz:=clock_timestamp(); starting timestamptz; previous_start timestamptz; result jsonb;
begin
 if not public.is_admin() then raise exception 'Admin only';end if;
 if p_days not in(7,30,90) then raise exception 'Invalid period';end if;
 starting:=ending-make_interval(days=>p_days);previous_start:=starting-make_interval(days=>p_days);
 select jsonb_build_object(
 'started_at',(select started_at from public.site_traffic_configuration where id),
 'start',starting,'end',ending,
 'views',count(*) filter(where created_at>=starting),
 'visits',count(distinct session_id) filter(where created_at>=starting),
 'previous_views',count(*) filter(where created_at<starting),
 'previous_visits',count(distinct session_id) filter(where created_at<starting),
 'daily',coalesce((select jsonb_agg(d order by d.day) from (select (created_at at time zone 'Asia/Kathmandu')::date as day,count(*) as views,count(distinct session_id) as visits from public.site_visit_events where created_at>=starting and created_at<ending group by 1)d),'[]'::jsonb),
 'pages',coalesce((select jsonb_agg(p order by p.views desc) from (select page_group as page,count(*) as views from public.site_visit_events where created_at>=starting and created_at<ending group by page_group)p),'[]'::jsonb),
 'sources',coalesce((select jsonb_agg(s order by s.visits desc) from (select source_group as source,count(distinct session_id) as visits from public.site_visit_events where created_at>=starting and created_at<ending group by source_group)s),'[]'::jsonb)
 ) into result from public.site_visit_events where created_at>=previous_start and created_at<ending;
 return result;
end;$$;
revoke all on function public.site_traffic_report(integer) from public,anon;
grant execute on function public.site_traffic_report(integer) to authenticated;
commit;
