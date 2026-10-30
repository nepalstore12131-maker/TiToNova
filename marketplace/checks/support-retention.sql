-- Run inside the migration's test transaction before rollback.
create temp table retention_ids(kind text,id uuid);
with t as (insert into public.support_tickets(owner_id,subject,topic,status,resolved_at) values ((select id from public.profiles where role='freelancer' limit 1),'Expired test','Other','resolved',now()-interval '25 hours') returning id) insert into retention_ids select 'expired',id from t;
with t as (insert into public.support_tickets(owner_id,subject,topic,status,resolved_at) values ((select id from public.profiles where role='freelancer' limit 1),'Recent test','Other','resolved',now()-interval '23 hours') returning id) insert into retention_ids select 'recent',id from t;
with t as (insert into public.support_tickets(owner_id,subject,topic,status,created_at) values ((select id from public.profiles where role='freelancer' limit 1),'Open old test','Other','open',now()-interval '10 days') returning id) insert into retention_ids select 'open',id from t;
with t as (insert into public.support_tickets(owner_id,subject,topic,status,created_at) values ((select id from public.profiles where role='freelancer' limit 1),'Progress old test','Other','in_progress',now()-interval '10 days') returning id) insert into retention_ids select 'progress',id from t;
insert into public.notifications(recipient_id,kind,title,href) select (select id from public.profiles where role='freelancer' limit 1),'support','Expired test alert','/dashboard/support/'||id from retention_ids where kind='expired';
select public.purge_resolved_support();
do $$begin
 if exists(select 1 from public.support_tickets where id=(select id from retention_ids where kind='expired')) then raise exception 'Expired request retained'; end if;
 if (select count(*) from public.support_tickets where id in (select id from retention_ids where kind<>'expired'))<>3 then raise exception 'Unexpired or unresolved request removed'; end if;
 if exists(select 1 from public.notifications where href='/dashboard/support/'||(select id from retention_ids where kind='expired')) then raise exception 'Expired notification retained'; end if;
 if has_function_privilege('authenticated','public.purge_resolved_support()','EXECUTE') then raise exception 'Member can run cleanup'; end if;
end$$;
select set_config('request.jwt.claim.sub',(select owner_id::text from public.support_tickets where id=(select id from retention_ids where kind='recent')),true),set_config('test.closed_ticket',(select id::text from retention_ids where kind='recent'),true);
set local role authenticated;
do $$begin
 begin perform public.reply_support_ticket(current_setting('test.closed_ticket')::uuid,'Must not reopen'); raise exception 'Closed reply accepted'; exception when raise_exception then if sqlerrm<>'support_closed' then raise; end if; end;
end$$;
reset role;
update public.support_tickets set status='open' where id=(select id from retention_ids where kind='recent');
do $$begin
 if exists(select 1 from public.support_tickets where id=(select id from retention_ids where kind='recent') and resolved_at is not null) then raise exception 'Reopen did not cancel deletion'; end if;
end$$;
rollback;
select 'PASS: only expired resolved requests removed; recent/open/in-progress kept; notifications cleaned; closed replies blocked; reopening cancels expiry; all test changes rolled back' as result;
