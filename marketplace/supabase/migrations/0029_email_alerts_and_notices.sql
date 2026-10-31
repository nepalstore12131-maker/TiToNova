begin;
create table public.notification_preferences (
 user_id uuid primary key references public.profiles(id) on delete cascade,
 email_kinds text[] not null default '{}',
 job_alerts boolean not null default false,
 categories text[] not null default '{}', keywords text[] not null default '{}',
 location text not null default '' check(char_length(location)<=120),
 updated_at timestamptz not null default now(),
 check(email_kinds <@ array['job_alert','invitation','application','message','interview','work','service','payment','promotion','advertising','listing','review','support','moderation','announcement']::text[]),
 check(cardinality(categories)<=30 and cardinality(keywords)<=15),
 check(char_length(array_to_string(categories,','))<=2500 and char_length(array_to_string(keywords,','))<=500)
);
alter table public.notification_preferences enable row level security;
revoke all on public.notification_preferences from public,anon,authenticated;
grant select,insert,update on public.notification_preferences to authenticated;
create policy "Own notification preferences" on public.notification_preferences for all to authenticated using(user_id=auth.uid()) with check(user_id=auth.uid());
grant all on public.notification_preferences to service_role;

create table public.admin_notices (
 id uuid primary key default gen_random_uuid(), creator_id uuid not null references public.profiles(id),
 audience text not null check(audience in('freelancer','employer','both')),
 title text not null check(char_length(btrim(title)) between 3 and 140),
 body text not null check(char_length(btrim(body)) between 10 and 4000),
 recipient_count integer not null default 0, created_at timestamptz not null default now()
);
create table public.notice_recipients (
 notice_id uuid not null references public.admin_notices(id) on delete cascade,
 user_id uuid not null references public.profiles(id) on delete cascade,
 primary key(notice_id,user_id)
);
alter table public.admin_notices enable row level security;
alter table public.notice_recipients enable row level security;
revoke all on public.admin_notices,public.notice_recipients from public,anon,authenticated;
grant select on public.admin_notices,public.notice_recipients to authenticated;
create policy "Notice audience history" on public.notice_recipients for select to authenticated using(user_id=auth.uid() or public.is_admin());
create policy "Read own delivered notices" on public.admin_notices for select to authenticated using(public.is_admin() or exists(select 1 from public.notice_recipients r where r.notice_id=id and r.user_id=auth.uid()));
grant all on public.admin_notices,public.notice_recipients to service_role;
alter table public.notifications drop constraint notifications_href_check;
alter table public.notifications add constraint notifications_href_check check(href like '/dashboard/%' or href like '/jobs/%');

create table public.email_outbox (
 id uuid primary key default gen_random_uuid(), notification_id uuid not null unique references public.notifications(id) on delete cascade,
 recipient_id uuid not null references public.profiles(id) on delete cascade,
 kind text not null, status text not null default 'pending' check(status in('pending','sending','sent','skipped','failed')),
 attempts integer not null default 0, available_at timestamptz not null default now(),
 first_attempt_at timestamptz, lease_until timestamptz, claim_token uuid,
 payload jsonb, provider_id text, last_error text, created_at timestamptz not null default now(), sent_at timestamptz
);
alter table public.email_outbox enable row level security;
revoke all on public.email_outbox from public,anon,authenticated;
grant all on public.email_outbox to service_role;
create index email_outbox_pending on public.email_outbox(available_at) where status in('pending','sending');
create function public.queue_notification_email() returns trigger language plpgsql security definer set search_path=public as $$
declare k text;
begin
 k:=case when new.kind='hiring' and new.href='/dashboard/invitations' then 'invitation'
 when new.kind in('application','withdrawal','hiring') then 'application' else new.kind end;
 if exists(select 1 from public.notification_preferences p where p.user_id=new.recipient_id and k=any(p.email_kinds)) then
 insert into public.email_outbox(notification_id,recipient_id,kind) values(new.id,new.recipient_id,k) on conflict do nothing;
 end if;return new;
end;$$;
create trigger notifications_queue_email after insert on public.notifications for each row execute function public.queue_notification_email();

-- One alert per recipient per job, even after editing or republishing.
create table public.job_alert_deliveries(job_id uuid not null references public.jobs(id) on delete cascade,user_id uuid not null references public.profiles(id) on delete cascade,primary key(job_id,user_id));
alter table public.job_alert_deliveries enable row level security;
revoke all on public.job_alert_deliveries from public,anon,authenticated;
grant all on public.job_alert_deliveries to service_role;
create function public.queue_matching_job_alerts() returns trigger language plpgsql security definer set search_path=public as $$
begin
 if new.status<>'published' or new.service_offer_id is not null or new.archived_at is not null then return new;end if;
 if tg_op='UPDATE' and old.status='published' then return new;end if;
 if new.applications_close_at is not null and new.applications_close_at<=now() then return new;end if;
 with recipients as (
 insert into public.job_alert_deliveries(job_id,user_id)
 select new.id,p.user_id from public.notification_preferences p join public.profiles u on u.id=p.user_id
 where u.role='freelancer' and p.job_alerts and not public.account_is_suspended(u.id)
 and (cardinality(p.categories)>0 or cardinality(p.keywords)>0)
 and (new.category=any(p.categories) or exists(select 1 from unnest(p.keywords) k where char_length(btrim(k))>=2 and position(lower(btrim(k)) in lower(new.title||' '||new.description||' '||new.category))>0))
 and (p.location='' or position(lower(p.location) in lower(new.location))>0)
 on conflict do nothing returning user_id
 ) insert into public.notifications(recipient_id,kind,title,href)
 select user_id,'job_alert',left('New matching job: '||new.title,180),'/jobs/'||new.id from recipients;
 return new;
end;$$;
create trigger jobs_matching_alerts after insert or update of status on public.jobs for each row execute function public.queue_matching_job_alerts();

create function public.send_admin_notice(p_id uuid,p_audience text,p_title text,p_body text,p_expected_count integer) returns uuid language plpgsql security definer set search_path=public as $$
declare total integer;
begin
 if not public.is_admin() then raise exception 'Admin only';end if;
 perform pg_advisory_xact_lock(298311);
 if exists(select 1 from public.admin_notices where id=p_id) then return p_id;end if;
 if p_audience not in('freelancer','employer','both') then raise exception 'Invalid audience';end if;
 select count(*) into total from public.profiles where role::text in('freelancer','employer') and (p_audience='both' or role::text=p_audience);
 if total<>p_expected_count then raise exception 'Audience changed. Preview again.';end if;
 if (select count(*) from public.admin_notices where created_at>now()-interval '1 day')>=10 then raise exception 'Daily notice limit reached';end if;
 insert into public.admin_notices(id,creator_id,audience,title,body,recipient_count) values(p_id,auth.uid(),p_audience,btrim(p_title),btrim(p_body),total);
 insert into public.notice_recipients(notice_id,user_id) select p_id,id from public.profiles where role::text in('freelancer','employer') and (p_audience='both' or role::text=p_audience);
 insert into public.notifications(recipient_id,kind,title,href) select user_id,'announcement',btrim(p_title),'/dashboard/notices/'||p_id from public.notice_recipients where notice_id=p_id;
 return p_id;
end;$$;
revoke all on function public.send_admin_notice(uuid,text,text,text,integer) from public;
grant execute on function public.send_admin_notice(uuid,text,text,text,integer) to authenticated;

create function public.claim_notification_emails(p_limit integer default 10) returns setof public.email_outbox language plpgsql security definer set search_path=public as $$
begin
 -- Resend idempotency expires after 24h. Never automatically retry an uncertain send beyond 23h.
 update public.email_outbox set status='failed',last_error='Delivery uncertain: review required' where status in('pending','sending') and first_attempt_at<now()-interval '23 hours';
 return query with picked as (
 select id from public.email_outbox where ((status='pending' and available_at<=now()) or (status='sending' and lease_until<now())) and attempts<5
 order by created_at for update skip locked limit least(greatest(p_limit,1),20)
 ) update public.email_outbox o set status='sending',attempts=o.attempts+1,first_attempt_at=coalesce(o.first_attempt_at,now()),lease_until=now()+interval '3 minutes',claim_token=gen_random_uuid()
 from picked where o.id=picked.id returning o.*;
end;$$;
revoke all on function public.claim_notification_emails(integer) from public,anon,authenticated;
grant execute on function public.claim_notification_emails(integer) to service_role;
revoke all on function public.queue_notification_email(),public.queue_matching_job_alerts() from public,anon,authenticated;
commit;
