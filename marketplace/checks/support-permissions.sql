begin;
-- Test-only requests and notifications are discarded at rollback.
create temp table support_test_users as select
 (select id from public.profiles where role='freelancer' order by id limit 1) member_id,
 (select id from public.profiles where role='employer' order by id limit 1) outsider_id,
 (select id from public.profiles where role='admin' order by id limit 1) admin_id;
select set_config('test.support_member',(select member_id::text from support_test_users),true),
 set_config('test.support_outsider',(select outsider_id::text from support_test_users),true),
 set_config('test.support_admin',(select admin_id::text from support_test_users),true);
select set_config('request.jwt.claim.sub',current_setting('test.support_member'),true);
set local role authenticated;
select set_config('test.support_ticket',public.create_support_ticket('Temporary support test','Other','Please help with this test request')::text,true);
do $$begin
 if not exists(select 1 from public.support_messages where ticket_id=current_setting('test.support_ticket')::uuid) then raise exception 'Owner cannot read own message'; end if;
 begin
  perform public.set_support_status(current_setting('test.support_ticket')::uuid,'resolved');
  raise exception 'Member changed admin-only status';
 exception when raise_exception then if sqlerrm <> 'Admin access required' then raise; end if; end;
end$$;
reset role;
select set_config('request.jwt.claim.sub',current_setting('test.support_outsider'),true);
set local role authenticated;
do $$begin
 if exists(select 1 from public.support_tickets where id=current_setting('test.support_ticket')::uuid) or exists(select 1 from public.support_messages where ticket_id=current_setting('test.support_ticket')::uuid) then raise exception 'Private support leaked'; end if;
 begin
  perform public.reply_support_ticket(current_setting('test.support_ticket')::uuid,'Unauthorized reply');
  raise exception 'Unauthorized reply succeeded';
 exception when raise_exception then if sqlerrm <> 'Support request unavailable' then raise; end if; end;
end$$;
reset role;
select set_config('request.jwt.claim.sub',current_setting('test.support_admin'),true);
set local role authenticated;
do $$begin
 if not exists(select 1 from public.notifications where href='/dashboard/support/'||current_setting('test.support_ticket')) then raise exception 'Admin notification missing'; end if;
end$$;
select public.reply_support_ticket(current_setting('test.support_ticket')::uuid,'Support reply test');
select public.set_support_status(current_setting('test.support_ticket')::uuid,'resolved');
reset role;
select set_config('request.jwt.claim.sub',current_setting('test.support_member'),true);
set local role authenticated;
do $$begin
 if not exists(select 1 from public.support_messages where ticket_id=current_setting('test.support_ticket')::uuid and from_admin) then raise exception 'Admin reply not visible'; end if;
 if not exists(select 1 from public.notifications where href='/dashboard/support/'||current_setting('test.support_ticket')) then raise exception 'Member notification missing'; end if;
end$$;
select public.reply_support_ticket(current_setting('test.support_ticket')::uuid,'Reopen request test');
do $$begin
 if not exists(select 1 from public.support_tickets where id=current_setting('test.support_ticket')::uuid and status='open') then raise exception 'Request did not reopen'; end if;
end$$;
reset role;
rollback;
select 'PASS: private owner/admin access, outsider blocked, admin replies/status, notifications and reopen; test data rolled back' as result;
