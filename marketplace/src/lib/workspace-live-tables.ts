// Only subscribe to the data used by the open page. Database RLS remains authoritative.
export function workspaceLiveTables(path: string): string[] {
  const common = ["account_suspensions"];
  const groups: [string[], string[]][] = [
    [["/hiring", "/applications", "/messages", "/interviews"], ["applications", "jobs", "interviews", "application_messages", "application_work_samples", "conversation_controls", "hiring_reviews"]],
    [["/work", "/earnings", "/reviews"], ["job_assignments", "work_agreements", "work_deliveries", "work_change_requests", "work_time_requests", "work_timeline", "work_reviews"]],
    [["/billing", "/payments"], ["employer_payment_requests", "employer_payment_settings"]],
    [["/support"], ["support_tickets", "support_messages"]],
    [["/disputes"], ["work_disputes", "work_dispute_messages", "account_suspensions"]],
    [["/invitations", "/saved-workers"], ["rehire_invitations", "saved_workers", "job_assignments"]],
    [["/settings", "/profile"], ["profile_photos", "candidate_profiles", "candidate_sample_library"]],
    [["/availability"], ["worker_availability"]],
    [["/jobs"], ["jobs", "applications", "job_photos", "employer_payment_requests", "employer_payment_settings"]],
    [["/promotions"], ["job_promotion_requests", "job_promotions", "promotion_plans"]],
    [["/advertising"], ["advertising_requests", "advertising_plans", "sponsor_banners"]],
    [["/email-settings"], ["notification_preferences"]],
    [["/notices"], ["admin_notices"]],
  ];
  const tables = groups.filter(([paths]) => paths.some(p => path.includes(p))).flatMap(([, tables]) => tables);
  if (path === "/dashboard") tables.push("applications", "jobs", "job_assignments", "employer_payment_settings");
  if (path.startsWith("/admin")) tables.push("profiles", "jobs", "applications", "employer_payment_requests", "job_reports", "message_reports", "support_tickets", "work_disputes", "work_reviews", "advertising_requests", "job_promotion_requests");
  return [...new Set([...common, ...tables])];
}
