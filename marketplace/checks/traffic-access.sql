begin;
do $$
declare sid uuid:=gen_random_uuid(); eid uuid:=gen_random_uuid(); admin_id uuid; r jsonb;
begin
 select id into admin_id from public.profiles where role='admin' limit 1;
 if admin_id is null then raise exception 'Admin fixture needed';end if;
 set local role service_role;
 perform public.record_site_visit(eid,sid,'Jobs','TikTok');
 perform public.record_site_visit(eid,sid,'Jobs','TikTok');
 reset role;
 if (select count(*) from public.site_visit_events where session_id=sid)<>1 then raise exception 'Duplicate event counted';end if;
 set local role anon;
 begin perform public.record_site_visit(gen_random_uuid(),sid,'Jobs','TikTok');raise exception 'Anon can record directly';exception when insufficient_privilege then null;end;
 begin perform count(*) from public.site_visit_events;raise exception 'Raw traffic exposed';exception when insufficient_privilege then null;end;
 reset role;
 perform set_config('request.jwt.claims','{}',true);set local role authenticated;
 begin perform public.site_traffic_report(7);raise exception 'Non-admin saw report';exception when raise_exception then if sqlerrm<>'Admin only' then raise;end if;end;
 reset role;perform set_config('request.jwt.claims',json_build_object('sub',admin_id,'role','authenticated')::text,true);set local role authenticated;
 r:=public.site_traffic_report(7);
 if (r->>'views')::integer<1 or (r->>'visits')::integer<1 then raise exception 'Admin aggregate missing';end if;
 reset role;
end $$;
select 'PASS: service write, duplicate event suppression, private raw data and admin-only report. Rollback only.' as result;
rollback;
