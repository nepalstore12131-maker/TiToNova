import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { updateApplicationStatus } from "@/app/jobs/actions";
import { PortalShell, type AccountRole } from "@/components/portal-shell";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ id: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> };
const one = (value: string | string[] | undefined) => Array.isArray(value) ? value[0] ?? "" : value ?? "";

export default async function ApplicationDetailPage({ params, searchParams }: Props) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const supabase = await createClient();
  if (!supabase) return <main className="dashboard"><div className="setup-alert">Connect the shared database to open application details.</div></main>;
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const { data: profile, error: profileError } = await supabase.from("profiles").select("role").eq("id", user.id).maybeSingle();
  if (profileError || !profile) return <main className="dashboard"><div className="form-alert" role="alert">We couldn’t load your account details. Refresh the page and try again.</div></main>;
  const role = profile.role as AccountRole;
  if (role === "admin") redirect("/admin");

  const { data: application, error: applicationError } = await supabase.from("applications").select("id,status,created_at,cover_note,job:jobs!applications_job_id_fkey(id,title,description,location,employer_id),applicant:profiles!applications_applicant_id_fkey(full_name,headline,bio,location,skills,portfolio_url,linkedin_url)").eq("id", id).maybeSingle();
  if (applicationError) return <main className="dashboard"><div className="form-alert" role="alert">We couldn’t load this application. Refresh the page and try again.</div><Link href="/dashboard/applications">Back to applications →</Link></main>;
  if (!application) notFound();
  const job = Array.isArray(application.job) ? application.job[0] : application.job;
  const applicant = Array.isArray(application.applicant) ? application.applicant[0] : application.applicant;
  const paramsValue = await searchParams;
  const success = one(paramsValue.success);
  const error = one(paramsValue.error);

  return <PortalShell role={role} activePath="/dashboard/applications">
    <p style={{ margin: "0 0 18px", fontSize: 12 }}><Link href="/dashboard/applications" style={{ color: "var(--green)" }}>← Applications</Link></p>
    <div className="eyebrow">Application details</div><h1>{role === "employer" ? applicant?.full_name || "Freelancer" : job?.title || "Job application"}</h1>
    {success === "updated" && <div className="setup-alert">The application status was updated.</div>}
    {error && <div className="form-alert">We couldn’t update this application. It may have already changed.</div>}
    <section className="dashboard-card">
      {role === "employer" ? <>
        <div className="detail-label">Applied for</div><p style={{ margin: 0 }}><Link href={`/dashboard/jobs/${job?.id}/edit`} style={{ color: "var(--green)", fontWeight: 700 }}>{job?.title || "Your job"}</Link></p>
        {applicant?.headline && <><div className="detail-label">Headline</div><p style={{ margin: 0 }}>{applicant.headline}</p></>}
        {applicant?.location && <><div className="detail-label">Location</div><p style={{ margin: 0 }}>{applicant.location}</p></>}
        {applicant?.skills?.length > 0 && <><div className="detail-label">Skills</div><p style={{ margin: 0 }}>{applicant.skills.join(" · ")}</p></>}
        {applicant?.bio && <><div className="detail-label">About the candidate</div><p style={{ color: "var(--muted)", fontSize: 13, lineHeight: 1.7, whiteSpace: "pre-wrap" }}>{applicant.bio}</p></>}
        {applicant?.portfolio_url && <p><a href={applicant.portfolio_url} target="_blank" rel="noreferrer" style={{ color: "var(--green)" }}>Portfolio ↗</a>{applicant.linkedin_url && <> · <a href={applicant.linkedin_url} target="_blank" rel="noreferrer" style={{ color: "var(--green)" }}>LinkedIn ↗</a></>}</p>}
      </> : <>
        <div className="detail-label">Applied to</div><p style={{ margin: 0 }}><Link href={`/jobs/${job?.id}`} style={{ color: "var(--green)", fontWeight: 700 }}>{job?.title || "Job listing"}</Link></p>
        <div className="detail-label">Status</div><p style={{ margin: 0 }}><span className={`status-tag status-${application.status}`}>{application.status}</span></p>
      </>}
      <div className="detail-label">Your introduction</div><p style={{ color: "var(--muted)", fontSize: 13, lineHeight: 1.7, whiteSpace: "pre-wrap" }}>{application.cover_note}</p>
      {role === "employer" && application.status === "submitted" && <div className="inline-form"><form action={updateApplicationStatus}><input type="hidden" name="application_id" value={application.id} /><input type="hidden" name="status" value="shortlisted" /><button className="button small" type="submit">Shortlist</button></form><form action={updateApplicationStatus}><input type="hidden" name="application_id" value={application.id} /><input type="hidden" name="status" value="rejected" /><button className="button small danger" type="submit">Decline</button></form></div>}
      {role === "freelancer" && application.status === "submitted" && <form action={updateApplicationStatus} style={{ marginTop: 18 }}><input type="hidden" name="application_id" value={application.id} /><input type="hidden" name="status" value="withdrawn" /><button className="button secondary small" type="submit">Withdraw application</button></form>}
    </section>
  </PortalShell>;
}
