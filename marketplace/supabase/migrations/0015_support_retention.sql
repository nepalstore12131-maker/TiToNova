begin;
alter table public.support_tickets add column resolved_at timestamptz;
-- Give already-resolved requests a full 24 hours from activation.
update public.support_tickets set resolved_at=now() where status='resolved';
create function public.track_support_resolution() returns trigger language plpgsql set search_path=public as $$
begin
 if new.status='resolved' then
  if old.status is distinct from 'resolved' then new.resolved_at:=now(); else new.resolved_at:=old.resolved_at; end if;
 else new.resolved_at:=null;
 end if;
 return new;
end;$$;
revoke all on function public.track_support_resolution() from public;
create trigger support_resolution_time before update on public.support_tickets for each row execute function public.track_support_resolution();
alter table public.support_tickets add constraint support_resolution_consistency check((status='resolved' and resolved_at is not null) or (status<>'resolved' and resolved_at is null));
create index support_tickets_expiry on public.support_tickets(resolved_at) where status='resolved';
create or replace function public.reply_support_ticket(p_ticket uuid,p_body text) returns void language plpgsql security definer set search_path=public as $$
declare t public.support_tickets%rowtype;
begin
 if auth.uid() is null then raise exception 'Sign in required'; end if;
 perform pg_advisory_xact_lock(hashtextextended(auth.uid()::text,14));
 select * into t from public.support_tickets where id=p_ticket for update;
 if t.id is null or (t.owner_id<>auth.uid() and not public.is_admin()) then raise exception 'Support request unavailable'; end if;
 if t.status='resolved' then raise exception 'support_closed'; end if;
 if char_length(btrim(coalesce(p_body,''))) not between 1 and 4000 then raise exception 'Invalid message'; end if;
 if (select count(*) from public.support_messages where sender_id=auth.uid() and created_at>now()-interval '1 hour')>=30 then raise exception 'support_rate_limit'; end if;
 insert into public.support_messages(ticket_id,sender_id,body,from_admin) values(t.id,auth.uid(),btrim(p_body),public.is_admin());
end;$$;
create function public.purge_resolved_support() returns integer language plpgsql security definer set search_path=public as $$
declare ids uuid[]; removed integer;
begin
 -- Lock selected tickets so a simultaneous reopen cannot be deleted.
 select array_agg(id) into ids from (select id from public.support_tickets where status='resolved' and resolved_at <= now()-interval '24 hours' order by resolved_at limit 500 for update skip locked) expired;
 if ids is null then return 0; end if;
 delete from public.notifications where kind='support' and href in (select '/dashboard/support/'||id from unnest(ids) id);
 delete from public.support_tickets where id=any(ids) and status='resolved' and resolved_at <= now()-interval '24 hours';
 get diagnostics removed=row_count;
 return removed;
end;$$;
-- Only the database scheduler/owner can execute permanent cleanup.
revoke all on function public.purge_resolved_support() from public,anon,authenticated,service_role;
create extension if not exists pg_cron;
select cron.schedule('titonova-resolved-support-cleanup','* * * * *','select public.purge_resolved_support();');
commit;
