begin;
alter table public.jobs add column submission_key uuid;
create unique index jobs_submission_once on public.jobs(employer_id,submission_key) where submission_key is not null;
create function public.guard_job_submission_key() returns trigger language plpgsql set search_path=public as $$
begin
 if tg_op='UPDATE' and new.submission_key is distinct from old.submission_key then raise exception 'Submission key cannot be changed';end if;
 return new;
end;$$;
create trigger jobs_submission_key_immutable before update on public.jobs for each row execute function public.guard_job_submission_key();
revoke all on function public.guard_job_submission_key() from public;
-- Old posts remain unchanged. New website submissions carry a unique form key.
commit;
