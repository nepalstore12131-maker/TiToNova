"use server";
import {scheduleNotificationEmails} from '@/lib/notification-email';

import { redirect } from "next/navigation";
import { requireAdminContext } from "@/lib/supabase/admin";

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function adminSetJobStatus(formData: FormData) {
  const { sessionClient } = await requireAdminContext();scheduleNotificationEmails();
  const id = String(formData.get("job_id") ?? "");
  const status = String(formData.get("status") ?? "");
  if (!uuidPattern.test(id) || !["draft", "pending_review", "published", "closed", "rejected"].includes(status)) redirect("/admin/listings?error=invalid");

  const { data, error } = await sessionClient.from("jobs").update({ status }).eq("id", id).select("id").maybeSingle();
  if (error || !data) redirect("/admin/listings?error=save");
  redirect("/admin/listings?success=updated");
}

export async function adminDeleteJob(formData: FormData) {
  const { sessionClient } = await requireAdminContext();scheduleNotificationEmails();
  const id = String(formData.get("job_id") ?? "");
  if (!uuidPattern.test(id) || String(formData.get("confirmation") ?? "") !== "DELETE") redirect("/admin/listings?error=confirm");

  const { data, error } = await sessionClient.from("jobs").delete().eq("id", id).select("id").maybeSingle();
  if (error || !data) redirect("/admin/listings?error=delete");
  redirect("/admin/listings?success=deleted");
}

export async function adminSetApplicationStatus(formData: FormData) {
  const { sessionClient } = await requireAdminContext();scheduleNotificationEmails();
  const id = String(formData.get("application_id") ?? "");
  const status = String(formData.get("status") ?? "");
  if (!uuidPattern.test(id) || !["submitted", "shortlisted", "rejected", "withdrawn"].includes(status)) redirect("/admin/applications?error=invalid");

  const { data, error } = await sessionClient.from("applications").update({ status }).eq("id", id).select("id").maybeSingle();
  if (error || !data) redirect("/admin/applications?error=save");
  redirect("/admin/applications?success=updated");
}

export async function adminSetEmployerReview(formData: FormData) {
  const { sessionClient } = await requireAdminContext();scheduleNotificationEmails();
  const id = String(formData.get("employer_id") ?? "");
  const reviewed = String(formData.get("reviewed") ?? "");
  if (!uuidPattern.test(id) || !["true", "false"].includes(reviewed)) redirect("/admin/employers?error=invalid");

  const { data, error } = await sessionClient
    .from("profiles")
    .update({ employer_verified: reviewed === "true" })
    .eq("id", id)
    .eq("role", "employer")
    .select("id")
    .maybeSingle();
  if (error || !data) redirect("/admin/employers?error=save");
  redirect(`/admin/employers?success=${reviewed === "true" ? "reviewed" : "unreviewed"}`);
}

export async function adminSetReportStatus(formData: FormData) {
  const { user, sessionClient } = await requireAdminContext();scheduleNotificationEmails();
  const id = String(formData.get("report_id") ?? "");
  const status = String(formData.get("status") ?? "");
  if (!uuidPattern.test(id) || !["open", "resolved", "dismissed"].includes(status)) redirect("/admin/reports?error=invalid");

  const { data, error } = await sessionClient
    .from("job_reports")
    .update({ status, reviewed_by: status === "open" ? null : user.id, reviewed_at: status === "open" ? null : new Date().toISOString() })
    .eq("id", id)
    .select("id")
    .maybeSingle();
  if (error || !data) redirect("/admin/reports?error=save");
  redirect("/admin/reports?success=updated");
}
