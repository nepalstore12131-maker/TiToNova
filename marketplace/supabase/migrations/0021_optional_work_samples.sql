begin;
create function public.valid_work_sample_links(p_links text[]) returns boolean language plpgsql immutable set search_path=public as $$
declare link text;
begin
 if p_links is null or cardinality(p_links)>5 or coalesce(char_length(array_to_string(p_links,E'\n')),0)>3000 then return false;end if;
 foreach link in array p_links loop
  if link is null or char_length(link)>1000 or link !~ '^https://(drive\.google\.com/[^[:space:]]+|docs\.google\.com/[^[:space:]]+|(www\.|m\.)?youtube\.com/(watch\?[^[:space:]]*v=[A-Za-z0-9_-]{11}([&#][^[:space:]]*)?|(shorts|embed)/[A-Za-z0-9_-]{11}([/?#][^[:space:]]*)?)|youtu\.be/[A-Za-z0-9_-]{11}([/?#][^[:space:]]*)?)$' then return false;end if;
 end loop;return true;
end;$$;
create table public.candidate_sample_library(id uuid primary key references public.profiles(id) on delete cascade,samples text not null default '' check(char_length(samples)<=3000),updated_at timestamptz not null default now());
alter table public.candidate_sample_library enable row level security;
revoke all on public.candidate_sample_library from public,anon,authenticated;
grant select,insert,update on public.candidate_sample_library to authenticated;
create policy "Candidates keep their sample library private" on public.candidate_sample_library for all to authenticated using(id=auth.uid() and public.current_account_role()='freelancer') with check(id=auth.uid() and public.current_account_role()='freelancer');
-- Preserve existing library text privately; stop exposing it with general career details.
insert into public.candidate_sample_library(id,samples) select id,portfolio_samples from public.candidate_profiles where portfolio_samples<>'';
update public.candidate_profiles set portfolio_samples='' where portfolio_samples<>'';
alter table public.candidate_profiles add constraint samples_use_private_library check(portfolio_samples='');
alter table public.jobs add column reference_links text[] not null default '{}' check(public.valid_work_sample_links(reference_links));
create table public.application_work_samples(
 application_id uuid not null references public.applications(id) on delete cascade,author_id uuid not null references public.profiles(id),links text[] not null default '{}' check(public.valid_work_sample_links(links)),updated_at timestamptz not null default now(),primary key(application_id,author_id)
);
alter table public.application_work_samples enable row level security;
revoke all on public.application_work_samples from public,anon,authenticated;
grant select,insert,update on public.application_work_samples to authenticated;
create policy "Application participants read shared samples" on public.application_work_samples for select to authenticated using(public.can_read_conversation(application_id));
create policy "Participants share only their own samples" on public.application_work_samples for insert to authenticated with check(author_id=auth.uid() and public.current_account_role() in ('freelancer','employer') and public.can_read_conversation(application_id));
create policy "Participants edit only their own samples" on public.application_work_samples for update to authenticated using(author_id=auth.uid() and public.can_read_conversation(application_id)) with check(author_id=auth.uid() and public.can_read_conversation(application_id));
create function public.submit_application_samples(p_job uuid,p_cover text,p_links text[] default '{}') returns uuid language plpgsql security invoker set search_path=public as $$
declare result uuid;
begin
 if not public.valid_work_sample_links(p_links) then raise exception 'Invalid sample links';end if;
 insert into public.applications(job_id,applicant_id,cover_note) values(p_job,auth.uid(),p_cover) returning id into result;
 if cardinality(p_links)>0 then insert into public.application_work_samples(application_id,author_id,links) values(result,auth.uid(),p_links);end if;
 return result;
end;$$;
revoke all on function public.valid_work_sample_links(text[]),public.submit_application_samples(uuid,text,text[]) from public;
grant execute on function public.valid_work_sample_links(text[]) to anon,authenticated;
grant execute on function public.submit_application_samples(uuid,text,text[]) to authenticated;
-- Optional application window, separate from assignment/work deadlines.
alter table public.jobs add column applications_open_at timestamptz,add column applications_close_at timestamptz,add column urgent boolean not null default false,
 add constraint application_window_order check(applications_close_at is null or applications_open_at is null or applications_close_at>applications_open_at);
create function public.enforce_application_window() returns trigger language plpgsql security definer set search_path=public as $$
declare j public.jobs%rowtype;
begin
 select * into j from public.jobs where id=new.job_id for share;
 if j.id is null or (j.applications_open_at is not null and j.applications_open_at>statement_timestamp()) or (j.applications_close_at is not null and j.applications_close_at<=statement_timestamp()) then raise exception 'Applications are not open for this job';end if;
 return new;
end;$$;
revoke all on function public.enforce_application_window() from public;
create trigger applications_window_guard before insert on public.applications for each row execute function public.enforce_application_window();
-- Existing view keeps its column order; add timing through explicit discovery query separately.
commit;
