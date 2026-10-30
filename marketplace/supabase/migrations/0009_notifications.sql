begin;
create table public.notifications (
 id uuid primary key default gen_random_uuid(),
 recipient_id uuid not null references public.profiles(id) on delete cascade,
 kind text not null,
 title text not null check(char_length(title)<=180),
 href text not null check(href like '/dashboard/%'),
 read_at timestamptz,
 created_at timestamptz not null default now()
);
alter table public.notifications enable row level security;
revoke all on public.notifications from anon, authenticated;
grant select on public.notifications to authenticated;
grant update(read_at) on public.notifications to authenticated;
create policy "Members read only their notifications" on public.notifications for select to authenticated using(recipient_id=auth.uid());
create policy "Members mark own notifications read" on public.notifications for update to authenticated using(recipient_id=auth.uid()) with check(recipient_id=auth.uid());
create index notifications_recipient_created_idx on public.notifications(recipient_id,created_at desc);
create index notifications_unread_idx on public.notifications(recipient_id) where read_at is null;
create function public.notify_application_event() returns trigger language plpgsql security definer set search_path=public as $$
declare employer uuid;
begin
 select employer_id into employer from public.jobs where id=new.job_id;
 if tg_op='INSERT' then
  insert into public.notifications(recipient_id,kind,title,href) values(employer,'application','A new candidate applied to your job','/dashboard/applications/'||new.id);
 elsif new.status='withdrawn' and old.status is distinct from new.status then
  insert into public.notifications(recipient_id,kind,title,href) values(employer,'withdrawal','A candidate withdrew their application','/dashboard/applications/'||new.id);
 elsif old.hiring_stage is distinct from new.hiring_stage or old.status is distinct from new.status then
  insert into public.notifications(recipient_id,kind,title,href) values(new.applicant_id,'hiring','Your application has a hiring update','/dashboard/applications/'||new.id);
 end if;
 return new;
end;$$;
create trigger applications_notify after insert or update on public.applications for each row execute function public.notify_application_event();
create function public.notify_message_event() returns trigger language plpgsql security definer set search_path=public as $$
declare applicant uuid; employer uuid; target uuid;
begin
 select a.applicant_id,j.employer_id into applicant,employer from public.applications a join public.jobs j on j.id=a.job_id where a.id=new.application_id;
 target:=case when new.sender_id=applicant then employer else applicant end;
 if target is not null and target<>new.sender_id then
 insert into public.notifications(recipient_id,kind,title,href) values(target,'message','You received a new application message','/dashboard/applications/'||new.application_id||'#conversation');
 end if;return new;
end;$$;
create trigger messages_notify after insert on public.application_messages for each row execute function public.notify_message_event();
create function public.notify_payment_event() returns trigger language plpgsql security definer set search_path=public as $$
begin
 if old.status is distinct from new.status and new.status in ('approved','rejected') then
 insert into public.notifications(recipient_id,kind,title,href) values(new.employer_id,'payment',case when new.status='approved' then 'Your Premium payment was approved' else 'Your Premium payment needs attention' end,'/dashboard/billing');
 end if;return new;
end;$$;
create trigger payments_notify after update on public.employer_payment_requests for each row execute function public.notify_payment_event();
create function public.notify_listing_event() returns trigger language plpgsql security definer set search_path=public as $$
begin
 if old.status is distinct from new.status and new.status in ('published','rejected') then
 insert into public.notifications(recipient_id,kind,title,href) values(new.employer_id,'listing',case when new.status='published' then 'Your job listing is now published' else 'Your job listing was not approved' end,'/dashboard/jobs');
 end if;return new;
end;$$;
create trigger listings_notify after update on public.jobs for each row execute function public.notify_listing_event();
commit;
