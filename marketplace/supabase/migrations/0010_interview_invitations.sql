begin;
create table public.interviews (
 id uuid primary key default gen_random_uuid(),
 application_id uuid not null references public.applications(id) on delete cascade,
 employer_id uuid not null references public.profiles(id) on delete cascade,
 applicant_id uuid not null references public.profiles(id) on delete cascade,
 starts_at timestamptz not null,
 duration_minutes integer not null check(duration_minutes between 15 and 240),
 meeting_url text not null default '' check(char_length(meeting_url)<=500),
 location text not null default '' check(char_length(location)<=250),
 instructions text not null default '' check(char_length(instructions)<=1500),
 response_note text not null default '' check(char_length(response_note)<=1000),
 status text not null default 'proposed' check(status in ('proposed','accepted','declined','reschedule_requested','cancelled','superseded')),
 created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
alter table public.interviews enable row level security;
revoke all on public.interviews from anon,authenticated;
grant select on public.interviews to authenticated;
create policy "Interview participants read their invitations" on public.interviews for select to authenticated using(applicant_id=auth.uid() or employer_id=auth.uid() or public.is_admin());
create index interviews_participant_start_idx on public.interviews(applicant_id,starts_at);
create index interviews_employer_start_idx on public.interviews(employer_id,starts_at);
create unique index interviews_one_active_per_application on public.interviews(application_id) where status in ('proposed','accepted');
create function public.propose_interview(p_application uuid,p_starts_at timestamptz,p_duration integer,p_url text,p_location text,p_instructions text) returns uuid language plpgsql security definer set search_path=public as $$
declare a public.applications%rowtype; e uuid; result uuid;
begin
 if not public.has_active_employer_premium() then raise exception 'Active employer Premium required'; end if;
 select a1.* into a from public.applications a1 join public.jobs j on j.id=a1.job_id where a1.id=p_application and j.employer_id=auth.uid();
 if not found then raise exception 'Application unavailable'; end if;
 e:=auth.uid();
 perform 1 from public.applications where id=p_application for update;
 select * into a from public.applications where id=p_application;
 if a.status not in ('submitted','shortlisted') or a.hiring_stage='hired' then raise exception 'Application is no longer active'; end if;
 if p_starts_at is null or p_starts_at<=now() or p_starts_at>now()+interval '180 days' or p_duration is null or p_duration not between 15 and 240 then raise exception 'Choose a future interview within 180 days'; end if;
 if p_url is null or p_location is null or p_instructions is null or char_length(p_url)>500 or char_length(p_location)>250 or char_length(p_instructions)>1500 or (btrim(p_url)='' and btrim(p_location)='') or (p_url<>'' and p_url!~ '^https://[^[:space:]]+$') then raise exception 'Enter a secure meeting link or location'; end if;
 perform pg_advisory_xact_lock(hashtext(least(e::text,a.applicant_id::text)));
 perform pg_advisory_xact_lock(hashtext(greatest(e::text,a.applicant_id::text)));
 if exists(select 1 from public.interviews i where i.application_id<>p_application and i.status in ('proposed','accepted') and (i.employer_id=e or i.applicant_id=a.applicant_id) and i.starts_at<p_starts_at+make_interval(mins=>p_duration) and i.starts_at+make_interval(mins=>i.duration_minutes)>p_starts_at) then raise exception 'Interview overlaps another active invitation'; end if;
 update public.interviews set status='superseded',updated_at=now() where application_id=p_application and status in ('proposed','accepted','reschedule_requested');
 insert into public.interviews(application_id,employer_id,applicant_id,starts_at,duration_minutes,meeting_url,location,instructions) values(p_application,e,a.applicant_id,p_starts_at,p_duration,p_url,p_location,p_instructions) returning id into result;
 update public.applications set hiring_stage='interview',status='shortlisted' where id=p_application;
 return result;
end;$$;
revoke all on function public.propose_interview(uuid,timestamptz,integer,text,text,text) from public;
grant execute on function public.propose_interview(uuid,timestamptz,integer,text,text,text) to authenticated;
create function public.respond_interview(p_id uuid,p_response text,p_note text default '') returns void language plpgsql security definer set search_path=public as $$
declare i public.interviews%rowtype;
begin
 select * into i from public.interviews where id=p_id and (applicant_id=auth.uid() or employer_id=auth.uid());
 if not found then raise exception 'Interview unavailable'; end if;
 perform pg_advisory_xact_lock(hashtext(least(i.employer_id::text,i.applicant_id::text)));
 perform pg_advisory_xact_lock(hashtext(greatest(i.employer_id::text,i.applicant_id::text)));
 select * into i from public.interviews where id=p_id for update;
 if p_note is null or char_length(p_note)>1000 then raise exception 'Response note is too long'; end if;
 if i.starts_at<=now() then raise exception 'This interview time has passed'; end if;
 if p_response='cancelled' then
  if i.employer_id<>auth.uid() or i.status not in ('proposed','accepted','reschedule_requested') then raise exception 'Only the employer can cancel an active invitation'; end if;
 else
  if i.applicant_id<>auth.uid() or p_response not in ('accepted','declined','reschedule_requested') or p_response is null or i.status<>'proposed' then raise exception 'This invitation is no longer awaiting your response'; end if;
 end if;
 update public.interviews set status=p_response,response_note=p_note,updated_at=now() where id=p_id;
end;$$;
revoke all on function public.respond_interview(uuid,text,text) from public;
grant execute on function public.respond_interview(uuid,text,text) to authenticated;
create function public.notify_interview_event() returns trigger language plpgsql security definer set search_path=public as $$
declare target uuid; title text;
begin
 if tg_op='INSERT' then target:=new.applicant_id;title:='You have a new interview invitation';
 elsif old.status is distinct from new.status and new.status in ('accepted','declined','reschedule_requested') then target:=new.employer_id;title:='A candidate responded to an interview invitation';
 elsif old.status is distinct from new.status and new.status='cancelled' then target:=new.applicant_id;title:='An interview invitation was cancelled';
 else return new; end if;
 insert into public.notifications(recipient_id,kind,title,href) values(target,'interview',title,'/dashboard/interviews');return new;
end;$$;
create trigger interviews_notify after insert or update on public.interviews for each row execute function public.notify_interview_event();
create function public.close_application_interviews() returns trigger language plpgsql security definer set search_path=public as $$
begin
 if new.status in ('withdrawn','rejected') and old.status is distinct from new.status then
 update public.interviews set status='cancelled',updated_at=now() where application_id=new.id and status in ('proposed','accepted','reschedule_requested');
 end if;return new;
end;$$;
create trigger applications_close_interviews after update on public.applications for each row execute function public.close_application_interviews();
commit;
