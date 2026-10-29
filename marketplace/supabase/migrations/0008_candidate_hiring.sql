begin;
create table public.candidate_profiles (
 id uuid primary key references public.profiles(id) on delete cascade,
 work_history text not null default '' check(char_length(work_history)<=6000),
 availability text not null default 'discuss' check(availability in ('now','two_weeks','one_month','discuss')),
 expected_pay integer check(expected_pay between 0 and 1000000000),
 pay_period text not null default 'month' check(pay_period in ('month','hour','project')),
 portfolio_samples text not null default '' check(char_length(portfolio_samples)<=3000),
 resume_path text not null default '', updated_at timestamptz not null default now()
);
alter table public.candidate_profiles enable row level security;
grant select,insert,update on public.candidate_profiles to authenticated;
create policy "Candidates edit their career details" on public.candidate_profiles for all to authenticated using(id=auth.uid() and public.current_account_role()='freelancer') with check(id=auth.uid() and public.current_account_role()='freelancer' and (resume_path='' or (storage.foldername(resume_path))[1]=auth.uid()::text));
create policy "Hiring teams read relevant candidates" on public.candidate_profiles for select to authenticated using(public.is_admin() or (public.has_active_employer_premium() and exists(select 1 from public.applications a join public.jobs j on j.id=a.job_id where a.applicant_id=candidate_profiles.id and j.employer_id=auth.uid())));
alter table public.applications add column hiring_stage text not null default 'new' check(hiring_stage in ('new','shortlisted','interview','hired','rejected'));
update public.applications set hiring_stage=case when status='shortlisted' then 'shortlisted' when status='rejected' then 'rejected' else 'new' end;
create function public.protect_hiring_stage() returns trigger language plpgsql set search_path=public as $$
begin
 if old.status is distinct from new.status and old.hiring_stage=new.hiring_stage and new.status in ('submitted','shortlisted','rejected') then new.hiring_stage := case when new.status='submitted' then 'new' else new.status::text end; end if;
 if old.hiring_stage is distinct from new.hiring_stage and coalesce(auth.role(),'')<>'service_role' and not public.is_admin() and (public.current_account_role()<>'employer' or not public.has_active_employer_premium() or not exists(select 1 from public.jobs j where j.id=old.job_id and j.employer_id=auth.uid())) then raise exception 'Only the hiring team can change hiring stages'; end if;
 return new;
end;$$;
create trigger applications_protect_hiring_stage before update on public.applications for each row execute function public.protect_hiring_stage();
create table public.hiring_reviews (
 application_id uuid primary key references public.applications(id) on delete cascade,
 notes text not null default '' check(char_length(notes)<=5000), updated_at timestamptz not null default now()
);
alter table public.hiring_reviews enable row level security;
grant select on public.hiring_reviews to authenticated;
create policy "Hiring teams read private notes" on public.hiring_reviews for select to authenticated using(public.is_admin() or (public.has_active_employer_premium() and exists(select 1 from public.applications a join public.jobs j on j.id=a.job_id where a.id=hiring_reviews.application_id and j.employer_id=auth.uid())));
create function public.save_hiring_review(p_application uuid,p_stage text,p_notes text) returns void language plpgsql security definer set search_path=public as $$
declare candidate public.applications%rowtype;
begin
 if not public.has_active_employer_premium() then raise exception 'Active employer Premium required'; end if;
 if p_stage not in ('new','shortlisted','interview','hired','rejected') or char_length(p_notes)>5000 or p_notes is null then raise exception 'Invalid hiring review'; end if;
 select a.* into candidate from public.applications a join public.jobs j on j.id=a.job_id where a.id=p_application and j.employer_id=auth.uid() for update of a;
 if not found or candidate.status='withdrawn' then raise exception 'Application unavailable'; end if;
 update public.applications set hiring_stage=p_stage,status=case when p_stage='new' then 'submitted'::public.application_status when p_stage='rejected' then 'rejected'::public.application_status else 'shortlisted'::public.application_status end where id=p_application;
 insert into public.hiring_reviews(application_id,notes) values(p_application,p_notes) on conflict(application_id) do update set notes=excluded.notes,updated_at=now();
end;$$;
revoke all on function public.save_hiring_review(uuid,text,text) from public;
grant execute on function public.save_hiring_review(uuid,text,text) to authenticated;
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types) values('candidate-resumes','candidate-resumes',false,5242880,array['application/pdf']);
create policy "Candidates upload PDF resumes" on storage.objects for insert to authenticated with check(bucket_id='candidate-resumes' and (storage.foldername(name))[1]=auth.uid()::text and public.current_account_role()='freelancer');
create policy "Relevant hiring teams read resumes" on storage.objects for select to authenticated using(bucket_id='candidate-resumes' and ((storage.foldername(name))[1]=auth.uid()::text or public.is_admin() or exists(select 1 from public.candidate_profiles c where c.resume_path=storage.objects.name)));
create policy "Candidates remove unlinked resumes" on storage.objects for delete to authenticated using(bucket_id='candidate-resumes' and (storage.foldername(name))[1]=auth.uid()::text and not exists(select 1 from public.candidate_profiles c where c.resume_path=storage.objects.name));
commit;
