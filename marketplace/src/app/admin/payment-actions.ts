"use server";

import { redirect } from "next/navigation";
import { requireAdminContext } from "@/lib/supabase/admin";

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const field = (formData: FormData, name: string, max: number) => String(formData.get(name) ?? "").trim().slice(0, max);

function validHttpsUrl(value: string) {
  if (!value) return true;
  try {
    return new URL(value).protocol === "https:";
  } catch {
    return false;
  }
}

export async function saveEmployerPaymentSettings(formData: FormData) {
  const { sessionClient } = await requireAdminContext();
  const price = Number(String(formData.get("premium_price_npr") ?? ""));
  const duration = Number(String(formData.get("premium_duration_days") ?? ""));
  const settings = {
    id: 1,
    premium_price_npr: price,
    premium_duration_days: duration,
    payment_instructions: field(formData, "payment_instructions", 1500),
    esewa_account_name: field(formData, "esewa_account_name", 120),
    esewa_account_id: field(formData, "esewa_account_id", 120),
    khalti_account_name: field(formData, "khalti_account_name", 120),
    khalti_account_id: field(formData, "khalti_account_id", 120),
    khalti_payment_url: field(formData, "khalti_payment_url", 500),
    bank_name: field(formData, "bank_name", 120),
    bank_account_name: field(formData, "bank_account_name", 120),
    bank_account_number: field(formData, "bank_account_number", 120),
    updated_at: new Date().toISOString(),
  };
  if (!Number.isInteger(price) || price < 0 || price > 100_000_000 || !Number.isInteger(duration) || duration < 1 || duration > 365 || !validHttpsUrl(settings.khalti_payment_url)) {
    redirect("/admin/payments/settings?error=invalid");
  }

  const { error } = await sessionClient.from("employer_payment_settings").upsert(settings, { onConflict: "id" });
  if (error) redirect("/admin/payments/settings?error=save");
  redirect("/admin/payments/settings?success=saved");
}

export async function reviewEmployerPayment(formData: FormData) {
  const { user, sessionClient } = await requireAdminContext();
  const id = String(formData.get("payment_request_id") ?? "");
  const decision = String(formData.get("decision") ?? "");
  const reviewNote = field(formData, "review_note", 1000);
  if (!uuidPattern.test(id) || !["approved", "rejected"].includes(decision)) redirect("/admin/payments?error=invalid");

  if (decision === "approved") {
    const { error } = await sessionClient.rpc("approve_employer_payment_request", { p_request_id: id, p_review_note: reviewNote });
    if (error) redirect("/admin/payments?error=review");
  } else {
    const { data, error } = await sessionClient
      .from("employer_payment_requests")
      .update({ status: "rejected", review_note: reviewNote, reviewed_by: user.id, reviewed_at: new Date().toISOString() })
      .eq("id", id)
      .eq("status", "pending")
      .select("id")
      .maybeSingle();
    if (error || !data) redirect("/admin/payments?error=review");
  }
  redirect(`/admin/payments?success=${decision}`);
}

export async function setEmployerPremiumAccess(formData: FormData) {
  const { sessionClient } = await requireAdminContext();
  const id = String(formData.get("employer_id") ?? "");
  const action = String(formData.get("access_action") ?? "");
  if (!uuidPattern.test(id) || !["extend", "revoke"].includes(action)) redirect("/admin/payments?error=invalid");

  const [{ data: employer }, { data: settings }] = await Promise.all([
    sessionClient.from("profiles").select("id,employer_premium_until").eq("id", id).eq("role", "employer").maybeSingle(),
    sessionClient.from("employer_payment_settings").select("premium_duration_days").eq("id", 1).maybeSingle(),
  ]);
  if (!employer) redirect("/admin/payments?error=account");

  const now = Date.now();
  const until = action === "revoke"
    ? new Date(now).toISOString()
    : new Date(Math.max(now, employer.employer_premium_until ? new Date(employer.employer_premium_until).getTime() : 0) + (settings?.premium_duration_days ?? 30) * 86400000).toISOString();
  const { data, error } = await sessionClient.from("profiles").update({ employer_premium_until: until }).eq("id", id).eq("role", "employer").select("id").maybeSingle();
  if (error || !data) redirect("/admin/payments?error=account");
  redirect(`/admin/payments?success=${action === "extend" ? "access-extended" : "access-revoked"}`);
}
