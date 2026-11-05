begin;
-- Keep the service-offer cycle valid at transaction end while deleting its rows.
alter table public.jobs alter constraint jobs_service_offer_id_fkey deferrable initially immediate;
alter table public.service_work_offers alter constraint service_work_offers_assignment_id_fkey deferrable initially immediate;

create schema if not exists private;
-- Trigger-only cleanup: no public RPC or new user DELETE grants.
create or replace function private.cleanup_deleted_account() returns trigger
language plpgsql security definer set search_path='' as $$
declare
 job_ids uuid[]; app_ids uuid[]; assignment_ids uuid[]; request_ids uuid[]; offer_ids uuid[]; dispute_ids uuid[];
begin
 if old.role='admin' then
  perform pg_advisory_xact_lock(551990314);
  if (select count(*) from public.profiles where role='admin')<=1 then raise exception 'Keep at least one administrator account active';end if;
 end if;
 set constraints public.jobs_service_offer_id_fkey, public.service_work_offers_assignment_id_fkey deferred;
 select coalesce(array_agg(id),'{}') into request_ids from public.service_requests where employer_id=old.id or worker_id=old.id;
 select coalesce(array_agg(id),'{}') into offer_ids from public.service_work_offers where request_id=any(request_ids);
 select coalesce(array_agg(id),'{}') into job_ids from public.jobs where employer_id=old.id or service_offer_id=any(offer_ids);
 select coalesce(array_agg(id),'{}') into app_ids from public.applications where applicant_id=old.id or job_id=any(job_ids);
 select coalesce(array_agg(id),'{}') into assignment_ids from public.job_assignments where worker_id=old.id or employer_id=old.id or job_id=any(job_ids) or application_id=any(app_ids);
 select coalesce(array_agg(id),'{}') into dispute_ids from public.work_disputes where reporter_id=old.id or respondent_id=old.id or assignment_id=any(assignment_ids);

 delete from public.account_suspensions where account_id=old.id or created_by=old.id or dispute_id=any(dispute_ids);
 update public.account_suspensions set revoked_by=null where revoked_by=old.id;
 delete from public.work_dispute_messages where sender_id=old.id or dispute_id=any(dispute_ids);
 delete from public.work_disputes where id=any(dispute_ids);
 update public.work_disputes set reviewed_by=null where reviewed_by=old.id;
 delete from public.work_reviews where author_id=old.id or recipient_id=old.id or assignment_id=any(assignment_ids);
 delete from public.work_change_requests where requester_id=old.id or assignment_id=any(assignment_ids);
 update public.work_change_requests set reviewed_by=null where reviewed_by=old.id;
 delete from public.work_deliveries where worker_id=old.id or assignment_id=any(assignment_ids);
 update public.work_deliveries set reviewed_by=null where reviewed_by=old.id;
 delete from public.work_time_requests where requester_id=old.id or assignment_id=any(assignment_ids);
 update public.work_time_requests set reviewed_by=null where reviewed_by=old.id;
 delete from public.work_agreements where proposed_by=old.id or accepted_by=old.id or assignment_id=any(assignment_ids);
 delete from public.service_work_offers where id=any(offer_ids) or assignment_id=any(assignment_ids);
 delete from public.job_assignments where id=any(assignment_ids);
 delete from public.rehire_invitations where employer_id=old.id or worker_id=old.id or job_id=any(job_ids) or application_id=any(app_ids);
 delete from public.application_work_samples where author_id=old.id;
 delete from public.saved_workers where employer_id=old.id or worker_id=old.id;
 delete from public.service_request_messages where sender_id=old.id or request_id=any(request_ids);
 delete from public.service_requests where id=any(request_ids);
 delete from public.worker_services where worker_id=old.id;
 delete from public.worker_availability where worker_id=old.id;
 delete from public.job_promotions where request_id in(select id from public.job_promotion_requests where employer_id=old.id or job_id=any(job_ids));
 delete from public.job_promotion_requests where employer_id=old.id or job_id=any(job_ids);
 update public.job_promotion_requests set reviewed_by=null where reviewed_by=old.id;
 delete from public.advertising_requests where employer_id=old.id;
 update public.advertising_requests set reviewed_by=null where reviewed_by=old.id;
 delete from public.admin_notices where creator_id=old.id;
 delete from public.applications where id=any(app_ids);
 delete from public.jobs where id=any(job_ids);
 -- Remaining profile children use their existing CASCADE / SET NULL rules.
 return old;
end;$$;
revoke all on function private.cleanup_deleted_account() from public,anon,authenticated,service_role;
create trigger cleanup_deleted_account before delete on public.profiles for each row execute function private.cleanup_deleted_account();

-- Storage objects must be removed through Storage API before Auth deletion.
create function public.account_deletion_files(p_account uuid)
returns table(bucket_id text,object_name text) language sql stable security invoker set search_path='' as $$
 select o.bucket_id,o.name from storage.objects o
 where o.owner_id=p_account::text
 or (o.bucket_id in ('profile-photos','job-photos','payment-proofs','promotion-proofs','advertising-proofs') and split_part(o.name,'/',1)=p_account::text)
 order by o.bucket_id,o.name;
$$;
revoke all on function public.account_deletion_files(uuid) from public,anon,authenticated;
grant execute on function public.account_deletion_files(uuid) to service_role;
commit;
