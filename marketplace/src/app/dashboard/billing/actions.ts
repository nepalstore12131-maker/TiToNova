"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

const proofTypes: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "application/pdf": "pdf",
};

export async function submitEmployerPayment(formData: FormData) {
  const supabase = await createClient();
  if (!supabase) redirect("/login?error=setup");
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/employer/login");
  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).maybeSingle();
  if (profile?.role !== "employer") redirect("/dashboard?error=employer-only");

  const paymentMethod = String(formData.get("payment_method") ?? "");
  const transactionCode = String(formData.get("transaction_code") ?? "").trim();
  const proof = formData.get("proof");
  if (!(["esewa", "khalti", "bank"] as const).includes(paymentMethod as "esewa" | "khalti" | "bank") || transactionCode.length < 4 || transactionCode.length > 120 || !(proof instanceof File) || proof.size < 1 || proof.size > 5 * 1024 * 1024 || !proofTypes[proof.type]) {
    redirect("/dashboard/billing?error=invalid");
  }

  const { data: settings, error: settingsError } = await supabase.from("employer_payment_settings").select("premium_price_npr,premium_duration_days,esewa_account_id,khalti_account_id,khalti_payment_url,bank_name,bank_account_number").eq("id", 1).maybeSingle();
  if (settingsError || !settings || settings.premium_price_npr < 1) redirect("/dashboard/billing?error=not-ready");

  const methodReady = paymentMethod === "esewa"
    ? Boolean(settings.esewa_account_id)
    : paymentMethod === "khalti"
      ? Boolean(settings.khalti_account_id || settings.khalti_payment_url)
      : Boolean(settings.bank_name && settings.bank_account_number);
  if (!methodReady) redirect("/dashboard/billing?error=method");

  const { data: existing } = await supabase.from("employer_payment_requests").select("id").eq("employer_id", user.id).eq("status", "pending").limit(1);
  if (existing?.length) redirect("/dashboard/billing?error=pending");

  const proofPath = `${user.id}/${crypto.randomUUID()}.${proofTypes[proof.type]}`;
  const { error: uploadError } = await supabase.storage.from("employer-payment-proofs").upload(proofPath, proof, {
    contentType: proof.type,
    cacheControl: "3600",
    upsert: false,
  });
  if (uploadError) redirect("/dashboard/billing?error=upload");

  const { error } = await supabase.from("employer_payment_requests").insert({
    employer_id: user.id,
    payment_method: paymentMethod,
    transaction_code: transactionCode,
    amount_npr: settings.premium_price_npr,
    plan_duration_days: settings.premium_duration_days,
    proof_path: proofPath,
  });
  if (error) {
    await supabase.storage.from("employer-payment-proofs").remove([proofPath]);
    if (error.code === "23505") redirect("/dashboard/billing?error=duplicate");
    redirect("/dashboard/billing?error=submit");
  }
  redirect("/dashboard/billing?success=submitted");
}
