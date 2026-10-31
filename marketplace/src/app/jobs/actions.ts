"use server";
import {scheduleNotificationEmails} from '@/lib/notification-email';

import {parseNepalDate} from "@/lib/application-window";
import {parseSamples} from "@/lib/work-samples";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

async function getSignedInMember() {
  const supabase = await createClient();
  if (!supabase) redirect("/login?error=setup");
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  scheduleNotificationEmails();
  const { data: profile } = await supabase.from("profiles").select("role,employer_premium_until").eq("id", user.id).maybeSingle();
  return { supabase, user, role: profile?.role as string | undefined, premiumUntil: profile?.employer_premium_until as string | null | undefined };
}

export async function createJob(formData: FormData) {
  const { supabase, user, role, premiumUntil } = await getSignedInMember();
  if (role !== "employer") redirect("/dashboard?error=employer-only");
  if (!premiumUntil || new Date(premiumUntil).getTime() <= Date.now()) redirect("/dashboard/billing?required=1");

  const submissionKey=String(formData.get("submission_key")||"");
  if(!/^[0-9a-f-]{36}$/i.test(submissionKey))redirect("/dashboard/jobs/new?error=save");
  const title = String(formData.get("title") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim();
  const referenceLinks=parseSamples(String(formData.get("reference_links")||""));
  let opens:string|null=null,closes:string|null=null;
  try{opens=parseNepalDate(String(formData.get("applications_open_at")||""));closes=parseNepalDate(String(formData.get("applications_close_at")||""));if(opens&&closes&&Date.parse(closes)<=Date.parse(opens))throw Error();}catch{redirect('/dashboard/jobs?error=application-window');}
  const urgent=formData.get("urgent")==="on";
  const category = String(formData.get("category") ?? "").trim();
  const location = String(formData.get("location") ?? "Remote").trim();
  const workType = String(formData.get("work_type") ?? "contract");
  const workerCount=Number(formData.get("worker_count")||1);
  const payPeriod = String(formData.get("pay_period") ?? "unspecified");
  const workMode = String(formData.get("work_mode") ?? "onsite");
  const experienceLevel = String(formData.get("experience_level") ?? "any");
  const payMinValue = String(formData.get("pay_min") ?? "").trim();
  const payMaxValue = String(formData.get("pay_max") ?? "").trim();
  const allowedTypes = new Set(["full_time", "part_time", "contract", "freelance"]);
  const payMin = payMinValue ? Number(payMinValue) : null;
  const payMax = payMaxValue ? Number(payMaxValue) : null;

  if (!Number.isInteger(workerCount)||workerCount<1||workerCount>50||!referenceLinks || title.length < 4 || title.length > 120 || description.length < 30 || description.length > 12000 || category.length < 2 || location.length > 120 || !allowedTypes.has(workType) || !["unspecified","month","hour","project"].includes(payPeriod) || !["onsite","hybrid","remote"].includes(workMode) || !["any","entry","mid","senior"].includes(experienceLevel) || (payMin !== null && (!Number.isInteger(payMin) || payMin < 0)) || (payMax !== null && (!Number.isInteger(payMax) || payMax < 0)) || (payMin !== null && payMax !== null && payMax < payMin)) {
    redirect("/dashboard/jobs/new?error=invalid");
  }

  const { data: created, error } = await supabase.from("jobs").insert({
    employer_id: user.id,
    submission_key: submissionKey,
    title,
    description,
    reference_links:referenceLinks,applications_open_at:opens,applications_close_at:closes,urgent,
    category,
    location: location || "Remote",
    work_type: workType,
    worker_count:workerCount,
    pay_period: payPeriod,
    work_mode: workMode,
    experience_level: experienceLevel,
    currency: "NPR",
    pay_min: payMin,
    pay_max: payMax,
    status: "pending_review",
  }).select("status").single();

  if(error?.code==="23505"){
    const {data:previous}=await supabase.from("jobs").select("id").eq("employer_id",user.id).eq("submission_key",submissionKey).maybeSingle();
    if(previous)redirect("/dashboard/jobs?success=already-posted");
  }
  if (error) redirect("/dashboard/jobs/new?error=save");
  redirect(`/dashboard/jobs?success=${created?.status === "published" ? "published" : "submitted"}`);
}

export async function applyToJob(formData: FormData) {
  const { supabase, user, role } = await getSignedInMember();
  const jobId = String(formData.get("job_id") ?? "");
  const coverNote = String(formData.get("cover_note") ?? "").trim();
  if (role !== "freelancer") redirect(`/jobs/${encodeURIComponent(jobId)}?error=freelancer-only`);
  if (!/^[0-9a-f-]{36}$/i.test(jobId) || coverNote.length < 20 || coverNote.length > 5000) redirect(`/jobs/${encodeURIComponent(jobId)}?error=invalid`);

  const samples=parseSamples(formData.getAll("sample_link").map(String).join("\n"));
  if(!samples)redirect(`/jobs/${jobId}?error=samples`);
  const { error } = await supabase.rpc("submit_application_samples", {p_job:jobId,p_cover:coverNote,p_links:samples});

  if (error) {
    if(error.message.includes("Applications are not open"))redirect(`/jobs/${jobId}?error=window`);
    if (error.code === "23505") redirect(`/jobs/${jobId}?error=duplicate`);
    redirect(`/jobs/${jobId}?error=apply`);
  }
  redirect("/dashboard?success=application-submitted");
}

export async function reportJob(formData: FormData) {
  const { supabase, user, role } = await getSignedInMember();
  const jobId = String(formData.get("job_id") ?? "");
  const reason = String(formData.get("reason") ?? "");
  const details = String(formData.get("details") ?? "").trim();
  const allowedReasons = new Set(["misleading", "spam", "suspicious", "inappropriate", "other"]);
  if (!/^[0-9a-f-]{36}$/i.test(jobId) || !allowedReasons.has(reason) || details.length > 1500) {
    redirect(`/jobs/${encodeURIComponent(jobId)}?report=invalid`);
  }
  if (role === "admin") redirect(`/jobs/${jobId}?report=unavailable`);

  const { data: job } = await supabase.from("jobs").select("employer_id,status").eq("id", jobId).maybeSingle();
  if (!job || job.status !== "published" || job.employer_id === user.id) {
    redirect(`/jobs/${jobId}?report=unavailable`);
  }

  const { error } = await supabase.from("job_reports").insert({
    job_id: jobId,
    reporter_id: user.id,
    reason,
    details,
  });
  if (error?.code === "23505") redirect(`/jobs/${jobId}?report=duplicate`);
  if (error) redirect(`/jobs/${jobId}?report=error`);
  redirect("/jobs?report=sent");
}

export async function reviewJob(formData: FormData) {
  const { supabase, user, role } = await getSignedInMember();
  if (role !== "admin") redirect("/admin/jobs?error=admin-only");
  const jobId = String(formData.get("job_id") ?? "");
  const status = String(formData.get("status") ?? "");
  if (!/^[0-9a-f-]{36}$/i.test(jobId) || !["published", "rejected"].includes(status)) redirect("/admin/jobs?error=invalid");

  const { data, error } = await supabase.from("jobs").update({ status }).eq("id", jobId).eq("status", "pending_review").select("id").maybeSingle();
  if (error || !data) redirect("/admin/jobs?error=review");
  void user;
  redirect("/admin/jobs?success=reviewed");
}

export async function updateApplicationStatus(formData: FormData) {
  const { supabase, user, role, premiumUntil } = await getSignedInMember();
  const applicationId = String(formData.get("application_id") ?? "");
  const status = String(formData.get("status") ?? "");
  if (!/^[0-9a-f-]{36}$/i.test(applicationId)) redirect("/dashboard/applications?error=invalid");

  const allowed = role === "employer"
    ? ["shortlisted", "rejected"]
    : role === "freelancer" ? ["withdrawn"] : [];
  if (!allowed.includes(status)) redirect("/dashboard/applications?error=role");
  if (role === "employer" && (!premiumUntil || new Date(premiumUntil).getTime() <= Date.now())) redirect("/dashboard/billing?required=1");

  let query = supabase.from("applications").update({ status }).eq("id", applicationId);
  if (role === "freelancer") query = query.eq("applicant_id", user.id).eq("status", "submitted");
  const { data, error } = await query.select("id").maybeSingle();
  if (error || !data) redirect(`/dashboard/applications/${applicationId}?error=save`);
  redirect(`/dashboard/applications/${applicationId}?success=updated`);
}

export async function saveProfile(formData: FormData) {
  const { supabase, user } = await getSignedInMember();
  const fullName = String(formData.get("full_name") ?? "").trim();
  const companyName = String(formData.get("company_name") ?? "").trim();
  const headline = String(formData.get("headline") ?? "").trim();
  const bio = String(formData.get("bio") ?? "").trim();
  const location = String(formData.get("location") ?? "").trim();
  const skills = String(formData.get("skills") ?? "").split(/[\n,]/).map((skill) => skill.trim()).filter(Boolean);
  const portfolioUrl = String(formData.get("portfolio_url") ?? "").trim();
  const linkedinUrl = String(formData.get("linkedin_url") ?? "").trim();
  const isWebUrl = (value: string) => {
    if (!value) return true;
    try {
      const parsed = new URL(value);
      return parsed.protocol === "https:" || parsed.protocol === "http:";
    } catch {
      return false;
    }
  };

  if (!fullName || fullName.length > 80 || companyName.length > 120 || headline.length > 120 || bio.length > 3000 || location.length > 120 || skills.length > 20 || skills.some((skill) => skill.length > 50) || portfolioUrl.length > 300 || linkedinUrl.length > 300 || !isWebUrl(portfolioUrl) || !isWebUrl(linkedinUrl)) {
    redirect("/dashboard/profile?error=invalid");
  }

  const { error } = await supabase.from("profiles").update({
    full_name: fullName,
    company_name: companyName,
    headline,
    bio,
    location,
    skills,
    portfolio_url: portfolioUrl,
    linkedin_url: linkedinUrl,
  }).eq("id", user.id);
  if (error) redirect("/dashboard/profile?error=save");
  redirect("/dashboard/profile?success=saved");
}

export async function updateJob(formData: FormData) {
  const { supabase, user, role, premiumUntil } = await getSignedInMember();
  if (role !== "employer") redirect("/dashboard?error=employer-only");
  if (!premiumUntil || new Date(premiumUntil).getTime() <= Date.now()) redirect("/dashboard/billing?required=1");
  const jobId = String(formData.get("job_id") ?? "");
  if (!/^[0-9a-f-]{36}$/i.test(jobId)) redirect("/dashboard/jobs?error=invalid");

  const { data: existing } = await supabase.from("jobs").select("status").eq("id", jobId).eq("employer_id", user.id).maybeSingle();
  if (!existing || existing.status === "closed") redirect("/dashboard/jobs?error=unavailable");

  const title = String(formData.get("title") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim();
  const referenceLinks=parseSamples(String(formData.get("reference_links")||""));
  let opens:string|null=null,closes:string|null=null;
  try{opens=parseNepalDate(String(formData.get("applications_open_at")||""));closes=parseNepalDate(String(formData.get("applications_close_at")||""));if(opens&&closes&&Date.parse(closes)<=Date.parse(opens))throw Error();}catch{redirect('/dashboard/jobs?error=application-window');}
  const urgent=formData.get("urgent")==="on";
  const category = String(formData.get("category") ?? "").trim();
  const location = String(formData.get("location") ?? "Remote").trim() || "Remote";
  const workType = String(formData.get("work_type") ?? "contract");
  const workerCount=Number(formData.get("worker_count")||1);
  const payPeriod = String(formData.get("pay_period") ?? "unspecified");
  const workMode = String(formData.get("work_mode") ?? "onsite");
  const experienceLevel = String(formData.get("experience_level") ?? "any");
  const payMinValue = String(formData.get("pay_min") ?? "").trim();
  const payMaxValue = String(formData.get("pay_max") ?? "").trim();
  const allowedTypes = new Set(["full_time", "part_time", "contract", "freelance"]);
  const payMin = payMinValue ? Number(payMinValue) : null;
  const payMax = payMaxValue ? Number(payMaxValue) : null;
  if (!Number.isInteger(workerCount)||workerCount<1||workerCount>50||!referenceLinks || title.length < 4 || title.length > 120 || description.length < 30 || description.length > 12000 || category.length < 2 || category.length > 80 || location.length > 120 || !allowedTypes.has(workType) || !["unspecified","month","hour","project"].includes(payPeriod) || !["onsite","hybrid","remote"].includes(workMode) || !["any","entry","mid","senior"].includes(experienceLevel) || (payMin !== null && (!Number.isInteger(payMin) || payMin < 0)) || (payMax !== null && (!Number.isInteger(payMax) || payMax < 0)) || (payMin !== null && payMax !== null && payMax < payMin)) {
    redirect(`/dashboard/jobs/${jobId}/edit?error=invalid`);
  }

  const status = existing.status === "rejected" ? "pending_review" : existing.status;
  const { error } = await supabase.from("jobs").update({ title, description, worker_count:workerCount, reference_links:referenceLinks, applications_open_at:opens,applications_close_at:closes,urgent, category, location, work_type: workType, pay_period: payPeriod, work_mode: workMode, experience_level: experienceLevel, pay_min: payMin, pay_max: payMax, status }).eq("id", jobId).eq("employer_id", user.id);
  if (error) redirect(`/dashboard/jobs/${jobId}/edit?error=save`);
  redirect("/dashboard/jobs?success=updated");
}

export async function closeJob(formData: FormData) {
  const { supabase, user, role } = await getSignedInMember();
  if (role !== "employer") redirect("/dashboard?error=employer-only");
  const jobId = String(formData.get("job_id") ?? "");
  if (!/^[0-9a-f-]{36}$/i.test(jobId)) redirect("/dashboard/jobs?error=invalid");
  const { data, error } = await supabase.from("jobs").update({ status: "closed" }).eq("id", jobId).eq("employer_id", user.id).eq("status", "published").select("id").maybeSingle();
  if (error || !data) redirect("/dashboard/jobs?error=close");
  redirect("/dashboard/jobs?success=closed");
}
