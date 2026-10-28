"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

async function getSignedInMember() {
  const supabase = await createClient();
  if (!supabase) redirect("/login?error=setup");
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).maybeSingle();
  return { supabase, user, role: profile?.role as string | undefined };
}

export async function createJob(formData: FormData) {
  const { supabase, user, role } = await getSignedInMember();
  if (role !== "employer") redirect("/dashboard?error=employer-only");

  const title = String(formData.get("title") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim();
  const category = String(formData.get("category") ?? "").trim();
  const location = String(formData.get("location") ?? "Remote").trim();
  const workType = String(formData.get("work_type") ?? "contract");
  const payMinValue = String(formData.get("pay_min") ?? "").trim();
  const payMaxValue = String(formData.get("pay_max") ?? "").trim();
  const allowedTypes = new Set(["full_time", "part_time", "contract", "freelance"]);
  const payMin = payMinValue ? Number(payMinValue) : null;
  const payMax = payMaxValue ? Number(payMaxValue) : null;

  if (title.length < 4 || title.length > 120 || description.length < 30 || description.length > 12000 || category.length < 2 || location.length > 120 || !allowedTypes.has(workType) || (payMin !== null && (!Number.isInteger(payMin) || payMin < 0)) || (payMax !== null && (!Number.isInteger(payMax) || payMax < 0)) || (payMin !== null && payMax !== null && payMax < payMin)) {
    redirect("/dashboard/jobs/new?error=invalid");
  }

  const { error } = await supabase.from("jobs").insert({
    employer_id: user.id,
    title,
    description,
    category,
    location: location || "Remote",
    work_type: workType,
    currency: "NPR",
    pay_min: payMin,
    pay_max: payMax,
    status: "pending_review",
  });

  if (error) redirect("/dashboard/jobs/new?error=save");
  redirect("/dashboard?success=job-submitted");
}

export async function applyToJob(formData: FormData) {
  const { supabase, user, role } = await getSignedInMember();
  const jobId = String(formData.get("job_id") ?? "");
  const coverNote = String(formData.get("cover_note") ?? "").trim();
  if (role !== "freelancer") redirect(`/jobs/${encodeURIComponent(jobId)}?error=freelancer-only`);
  if (!/^[0-9a-f-]{36}$/i.test(jobId) || coverNote.length < 20 || coverNote.length > 5000) redirect(`/jobs/${encodeURIComponent(jobId)}?error=invalid`);

  const { error } = await supabase.from("applications").insert({
    job_id: jobId,
    applicant_id: user.id,
    cover_note: coverNote,
  });

  if (error) {
    if (error.code === "23505") redirect(`/jobs/${jobId}?error=duplicate`);
    redirect(`/jobs/${jobId}?error=apply`);
  }
  redirect("/dashboard?success=application-submitted");
}

export async function reviewJob(formData: FormData) {
  const { supabase, user, role } = await getSignedInMember();
  if (role !== "admin") redirect("/dashboard?error=admin-only");
  const jobId = String(formData.get("job_id") ?? "");
  const status = String(formData.get("status") ?? "");
  if (!/^[0-9a-f-]{36}$/i.test(jobId) || !["published", "rejected"].includes(status)) redirect("/dashboard?error=invalid");

  const { error } = await supabase.from("jobs").update({ status }).eq("id", jobId).eq("status", "pending_review");
  if (error) redirect("/dashboard?error=review");
  void user;
  redirect("/dashboard?success=job-reviewed");
}
