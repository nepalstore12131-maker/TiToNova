begin;
create table public.support_tickets (
 id uuid primary key default gen_random_uuid(),
 owner_id uuid not null references public.profiles(id) on delete cascade,
 subject text not null check(char_length(subject) between 4 and 120),
 topic text not null check(topic in ('Account','Payments','Job posts','Applications','Messages','Privacy','Other')),
 status text not null default 'open' check(status in ('open','in_progress','resolved')),
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now()
);
create table public.support_messages (
 id uuid primary key default gen_random_uuid(),
 ticket_id uuid not null references public.support_tickets(id) on delete cascade,
 sender_id uuid not null references public.profiles(id) on delete cascade,
 body text not null check(char_length(btrim(body)) between 1 and 4000),
 from_admin boolean not null,
 created_at timestamptz not null default now()
);
alter table public.support_tickets enable row level security;
alter table public.support_messages enable row level security;
revoke all on public.support_tickets, public.support_messages from anon, authenticated;
grant select on public.support_tickets, public.support_messages to authenticated;
create policy "Private support tickets" on public.support_tickets for select to authenticated using(owner_id=auth.uid() or public.is_admin());
create policy "Private support conversations" on public.support_messages for select to authenticated using(exists(select 1 from public.support_tickets t where t.id=ticket_id and (t.owner_id=auth.uid() or public.is_admin())));
create index support_tickets_owner_updated on public.support_tickets(owner_id,updated_at desc);
create index support_tickets_status_updated on public.support_tickets(status,updated_at desc);
create index support_messages_ticket_created on public.support_messages(ticket_id,created_at desc);
create index support_messages_sender_created on public.support_messages(sender_id,created_at desc);
create function public.support_message_notify() returns trigger language plpgsql security definer set search_path=public as $$
declare t public.support_tickets%rowtype;
begin
 select * into t from public.support_tickets where id=new.ticket_id;
 update public.support_tickets set updated_at=now(),status=case when new.from_admin then 'in_progress' else 'open' end where id=t.id;
 if new.from_admin then
  insert into public.notifications(recipient_id,kind,title,href) values(t.owner_id,'support','Titonova Support replied to your request','/dashboard/support/'||t.id);
 else
  insert into public.notifications(recipient_id,kind,title,href)
   select id,'support','A member sent a support message','/dashboard/support/'||t.id from public.profiles where role='admin' and id<>new.sender_id;
 end if;
 return new;
end;$$;
revoke all on function public.support_message_notify() from public;
create trigger support_message_notification after insert on public.support_messages for each row execute function public.support_message_notify();
create function public.create_support_ticket(p_subject text,p_topic text,p_body text) returns uuid language plpgsql security definer set search_path=public as $$
declare ticket uuid;
begin
 if auth.uid() is null or not exists(select 1 from public.profiles where id=auth.uid()) then raise exception 'Sign in required'; end if;
 perform pg_advisory_xact_lock(hashtextextended(auth.uid()::text,14));
 if (select count(*) from public.support_tickets where owner_id=auth.uid() and created_at>now()-interval '24 hours')>=5 then raise exception 'support_rate_limit'; end if;
 if char_length(btrim(coalesce(p_subject,''))) not between 4 and 120 or char_length(btrim(coalesce(p_body,''))) not between 1 and 4000 then raise exception 'Invalid support request'; end if;
 insert into public.support_tickets(owner_id,subject,topic) values(auth.uid(),btrim(p_subject),p_topic) returning id into ticket;
 insert into public.support_messages(ticket_id,sender_id,body,from_admin) values(ticket,auth.uid(),btrim(p_body),public.is_admin());
 return ticket;
end;$$;
create function public.reply_support_ticket(p_ticket uuid,p_body text) returns void language plpgsql security definer set search_path=public as $$
declare t public.support_tickets%rowtype;
begin
 if auth.uid() is null then raise exception 'Sign in required'; end if;
 perform pg_advisory_xact_lock(hashtextextended(auth.uid()::text,14));
 select * into t from public.support_tickets where id=p_ticket for update;
 if t.id is null or (t.owner_id<>auth.uid() and not public.is_admin()) then raise exception 'Support request unavailable'; end if;
 if char_length(btrim(coalesce(p_body,''))) not between 1 and 4000 then raise exception 'Invalid message'; end if;
 if (select count(*) from public.support_messages where sender_id=auth.uid() and created_at>now()-interval '1 hour')>=30 then raise exception 'support_rate_limit'; end if;
 insert into public.support_messages(ticket_id,sender_id,body,from_admin) values(t.id,auth.uid(),btrim(p_body),public.is_admin());
end;$$;
create function public.set_support_status(p_ticket uuid,p_status text) returns void language plpgsql security definer set search_path=public as $$
declare t public.support_tickets%rowtype;
begin
 if not public.is_admin() then raise exception 'Admin access required'; end if;
 if p_status not in ('open','in_progress','resolved') then raise exception 'Invalid status'; end if;
 select * into t from public.support_tickets where id=p_ticket for update;
 if t.id is null then raise exception 'Support request unavailable'; end if;
 if t.status is distinct from p_status then
  update public.support_tickets set status=p_status,updated_at=now() where id=t.id;
  insert into public.notifications(recipient_id,kind,title,href) values(t.owner_id,'support',case when p_status='resolved' then 'Your support request was marked resolved' else 'Your support request has a status update' end,'/dashboard/support/'||t.id);
 end if;
end;$$;
revoke all on function public.create_support_ticket(text,text,text),public.reply_support_ticket(uuid,text),public.set_support_status(uuid,text) from public;
grant execute on function public.create_support_ticket(text,text,text),public.reply_support_ticket(uuid,text),public.set_support_status(uuid,text) to authenticated;
commit;
