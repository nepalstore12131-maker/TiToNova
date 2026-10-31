begin;
-- Expose aggregate reputation only; assignment rows and cancellation reasons stay private.
create function public.public_work_counts(p_profile uuid)
returns table(completed_count bigint,cancelled_count bigint)
language sql stable security definer set search_path=public as $$
 select count(*) filter(where state='completed'),count(*) filter(where state='cancelled')
 from public.job_assignments where worker_id=p_profile or employer_id=p_profile;
$$;
revoke all on function public.public_work_counts(uuid) from public;
grant execute on function public.public_work_counts(uuid) to anon,authenticated;
commit;
