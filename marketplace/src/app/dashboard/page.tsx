import Link from "next/link";
import { redirect } from "next/navigation";
import { signOut } from "@/app/auth/actions";
import { reviewJob } from "@/app/jobs/actions";
import { createClient } from "@/lib/supabase/server";

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };
const one = (value: string | string[] | undefined) => Array.isArray(value) ? value[0] ?? "" : value ?? "";
const date = (value: string) => new Date(value).toLocaleDateString("en-NP");

export default async function DashboardPage({ searchParams }: Props) {
  const supabase = await createClient();
  if (!supabase) return <div className="page-shell"><header className="site-header"><Link className="brand" href="/"><span className="brand-mark">↗</span> Titonova</Link></header><main className="dashboard"><div className="setup-alert">Account services aren’t configured yet. Add your Supabase project settings to enable member access.</div></main></div>;

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const [{ data: profile }, params] = await Promise.all([
    supabase.from("profiles").select("full_name, company_name, role").eq("id", user.id).maybeSingle(),
    searchParams,
  ]);
  const role = profile?.role ?? "freelancer";
  const roleLabel = role === "employer" ? "Employer" : role === "admin" ? "Administrator" : "Freelancer";
  const success = one(params.success);
  const error = one(params.error);

  let myJobs: any[] = [];
  let applications: any[] = [];
  let pendingJobs: any[] = [];
  if (role === "employer") {
    const [jobsResult, applicationsResult] = await Promise.all([
      supabase.from("jobs").select("id,title,status,created_at,category,location").eq("employer_id", user.id).order("created_at", { ascending: false }),
      supabase.from("applications").select("id,cover_note,status,created_at,job:jobs!applications_job_id_fkey(id,title),applicant:profiles!applications_applicant_id_fkey(full_name)").order("created_at", { ascending: false }).limit(40),
    ]);
    myJobs = jobsResult.data ?? [];
    applications = applicationsResult.data ?? [];
  } else if (role === "admin") {
    const { data } = await supabase.from("jobs").select("id,title,description,category,location,created_at,employer:profiles!jobs_employer_id_fkey(company_name,full_name)").eq("status", "pending_review").order("created_at", { ascending: true });
    pendingJobs = data ?? [];
  } else {
    const { data } = await supabase.from("applications").select("id,status,created_at,cover_note,job:jobs!applications_job_id_fkey(id,title,location)").eq("applicant_id", user.id).order("created_at", { ascending: false });
    applications = data ?? [];
  }

  return <div className="page-shell">
    <header className="site-header"><Link className="brand" href="/"><span className="brand-mark">↗</span> Titonova</Link><nav className="nav-links"><Link href="/jobs">Browse jobs</Link></nav><form action={signOut}><button className="text-button" type="submit">Log out</button></form></header>
    <main className="dashboard"><div className="eyebrow">{roleLabel} workspace</div><h1>Welcome{profile?.full_name ? `, ${profile.full_name}` : " to Titonova"}</h1><p style={{ color: "var(--muted)", fontSize: 14 }}>Signed in as {user.email}{profile?.company_name ? ` · ${profile.company_name}` : ""}</p>
      {success === "job-submitted" && <div className="setup-alert" style={{ marginTop: 18 }}>Your job has been submitted and is awaiting administrator review.</div>}
      {success === "application-submitted" && <div className="setup-alert" style={{ marginTop: 18 }}>Your application was submitted to the employer.</div>}
      {success === "job-reviewed" && <div className="setup-alert" style={{ marginTop: 18 }}>The job review decision was saved.</div>}
      {error && <div className="form-alert" style={{ marginTop: 18 }}>{error === "employer-only" ? "This page is for employer accounts." : error === "admin-only" ? "Administrator access is required for that action." : "We couldn’t complete that action. Please check your access and try again."}</div>}
      <section className="dashboard-card"><div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 14, flexWrap: "wrap" }}><div><span className="role-badge">{roleLabel}</span><h2 style={{ fontSize: 18, margin: "14px 0 5px" }}>Your workspace</h2><p style={{ color: "var(--muted)", fontSize: 12, margin: 0 }}>Your role determines which marketplace tools are available.</p></div>{role === "employer" && <Link className="button" href="/dashboard/jobs/new">Post a job →</Link>}{role === "freelancer" && <Link className="button" href="/jobs">Browse jobs →</Link>}</div></section>

      {role === "employer" && <>
        <section className="dashboard-card"><div className="section-heading" style={{ marginBottom: 12 }}><div><h2 style={{ fontSize: 18, margin: 0 }}>Your job listings</h2><p>New roles appear after administrator approval.</p></div></div>
          {myJobs.length === 0 ? <p style={{ color: "var(--muted)", fontSize: 13 }}>You haven’t posted a role yet.</p> : <div className="dashboard-list">{myJobs.map((job) => <article className="dashboard-row" key={job.id}><div><b>{job.title}</b><small>{job.category} · {job.location} · Posted {date(job.created_at)}</small></div><span className={`status-tag status-${job.status}`}>{job.status.replaceAll("_", " ")}</span></article>)}</div>}
        </section>
        <section className="dashboard-card"><div className="section-heading" style={{ marginBottom: 12 }}><div><h2 style={{ fontSize: 18, margin: 0 }}>Applications received</h2><p>Only applications to your own roles are shown.</p></div></div>
          {applications.length === 0 ? <p style={{ color: "var(--muted)", fontSize: 13 }}>No applications yet.</p> : <div className="dashboard-list">{applications.map((application) => { const job = Array.isArray(application.job) ? application.job[0] : application.job; const applicant = Array.isArray(application.applicant) ? application.applicant[0] : application.applicant; return <article className="dashboard-row" key={application.id}><div><b>{applicant?.full_name || "Freelancer"} · {job?.title || "Job"}</b><small>{application.cover_note}</small></div><span className={`status-tag status-${application.status}`}>{application.status}</span></article>; })}</div>}
        </section>
      </>}

      {role === "freelancer" && <section className="dashboard-card"><div className="section-heading" style={{ marginBottom: 12 }}><div><h2 style={{ fontSize: 18, margin: 0 }}>Your applications</h2><p>Follow the status of jobs you’ve applied to.</p></div></div>
        {applications.length === 0 ? <p style={{ color: "var(--muted)", fontSize: 13 }}>You haven’t applied to a job yet. <Link href="/jobs" style={{ color: "var(--green)", fontWeight: 700 }}>Browse open roles →</Link></p> : <div className="dashboard-list">{applications.map((application) => { const job = Array.isArray(application.job) ? application.job[0] : application.job; return <article className="dashboard-row" key={application.id}><div><b>{job?.title || "Job listing"}</b><small>{job?.location || "Location not specified"} · Applied {date(application.created_at)}</small></div><span className={`status-tag status-${application.status}`}>{application.status}</span></article>; })}</div>}
      </section>}

      {role === "admin" && <section className="dashboard-card"><div className="section-heading" style={{ marginBottom: 12 }}><div><h2 style={{ fontSize: 18, margin: 0 }}>Job review queue</h2><p>Approve suitable listings before they appear in public search.</p></div></div>
        {pendingJobs.length === 0 ? <p style={{ color: "var(--muted)", fontSize: 13 }}>No jobs are waiting for review.</p> : <div className="dashboard-list">{pendingJobs.map((job) => { const employer = Array.isArray(job.employer) ? job.employer[0] : job.employer; return <article className="dashboard-row admin-review-row" key={job.id}><div><b>{job.title}</b><small>{employer?.company_name || employer?.full_name || "Employer"} · {job.category} · {job.location}</small><p>{job.description}</p></div><div className="review-buttons"><form action={reviewJob}><input type="hidden" name="job_id" value={job.id} /><input type="hidden" name="status" value="published" /><button className="button small" type="submit">Approve</button></form><form action={reviewJob}><input type="hidden" name="job_id" value={job.id} /><input type="hidden" name="status" value="rejected" /><button className="button small danger" type="submit">Reject</button></form></div></article>; })}</div>}
      </section>}
    </main>
  </div>;
}
