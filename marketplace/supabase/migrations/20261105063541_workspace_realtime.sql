-- Existing RLS and grants remain unchanged. No server-only tables are published.
do $$
declare table_name text;
begin
 foreach table_name in array array['account_suspensions', 'admin_notices', 'advertising_plans', 'advertising_requests', 'application_messages', 'application_work_samples', 'applications', 'candidate_profiles', 'candidate_sample_library', 'conversation_controls', 'employer_payment_requests', 'employer_payment_settings', 'hiring_reviews', 'interviews', 'job_assignments', 'job_photos', 'job_promotion_requests', 'job_promotions', 'job_reports', 'jobs', 'message_reports', 'notification_preferences', 'notifications', 'profile_photos', 'profiles', 'promotion_plans', 'rehire_invitations', 'saved_workers', 'sponsor_banners', 'support_messages', 'support_tickets', 'work_agreements', 'work_change_requests', 'work_deliveries', 'work_dispute_messages', 'work_disputes', 'work_reviews', 'work_time_requests', 'work_timeline', 'worker_availability'] loop
  if to_regclass('public.' || table_name) is null then
   raise exception 'Missing realtime table: %',table_name;
  end if;
  if not exists(select 1 from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relname=table_name and c.relrowsecurity) then
   raise exception 'RLS required for %',table_name;
  end if;
  if not exists(select 1 from pg_publication_tables p where p.pubname='supabase_realtime' and p.schemaname='public' and p.tablename=table_name) then
   execute format('alter publication supabase_realtime add table public.%I',table_name);
  end if;
 end loop;
end $$;
