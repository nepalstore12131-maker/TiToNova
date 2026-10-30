import { BrandMark } from "@/components/brand-mark";
import Link from "next/link";
import { formatNpr } from "@/lib/discovery";
import { notFound } from "next/navigation";
import { applyToJob, reportJob } from "@/app/jobs/actions";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ id: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> };

export default async function JobDetailsPage({ params, searchParams }: Props) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const queryParams = await searchParams;
  const errorCode = Array.isArray(queryParams.error) ? queryParams.error[0] : queryParams.error;
  const reportCode = Array.isArray(queryParams.report) ? queryParams.report[0] : queryParams.report;
  const supabase = await createClient();
  if (!supabase) return <main className="dashboard"><div className="setup-alert">Job details will be available after the shared database is connected.</div><Link href="/jobs">Back to jobs</Link></main>;

  const { data: job, error: jobError } = await supabase.from("jobs").select("id,title,description,category,location,work_type,work_mode,experience_level,pay_period,currency,pay_min,pay_max,created_at,employer_id,employer:profiles!jobs_employer_id_fkey(full_name,company_name,employer_verified)").eq("id", id).eq("status", "published").maybeSingle();
  if (jobError) return <main className="dashboard"><div className="form-alert" role="alert">We couldn’t load this job. Refresh the page and try again.</div><Link href="/jobs">Back to jobs →</Link></main>;
  if (!job) notFound();
  const { data: { user } } = await supabase.auth.getUser();
  const { data: profile } = user ? await supabase.from("profiles").select("role").eq("id", user.id).maybeSingle() : { data: null };
  const employer = Array.isArray(job.employer) ? job.employer[0] : job.employer;
  const company = employer?.company_name || employer?.full_name || "Titonova employer";
  const pay = formatNpr(job.pay_min,job.pay_max,false,job.currency);

  return <div className="page-shell">
    <header className="site-header"><Link className="brand" href="/"><BrandMark /> Titonova</Link><nav className="nav-links"><Link href="/jobs">Browse jobs</Link><Link href="/dashboard">Dashboard</Link></nav><div className="nav-actions">{user ? <Link className="button" href="/dashboard">My workspace</Link> : <><Link className="text-button" href="/login">Log in</Link><Link className="button" href="/signup">Join Titonova</Link></>}</div></header>
    <main className="dashboard" style={{ maxWidth: 1100 }}>
      <p style={{ margin: "0 0 18px", fontSize: 12 }}><Link href="/jobs" style={{ color: "var(--green)" }}>← All jobs</Link></p>
      <div className="job-detail-grid">
        <article className="dashboard-card" style={{ marginTop: 0 }}>
          <div className="eyebrow">{job.category}</div><h1 style={{ marginTop: 10 }}>{job.title}</h1>
          <div className="job-meta" style={{ margin: "14px 0 22px" }}><div className="company"><span className="company-mark">{company.slice(0, 1).toUpperCase()}</span><div><Link className="company-name" href={`/companies/${job.employer_id}`}>{company}</Link><span className="company-place">{job.location}</span>{employer?.employer_verified && <span className="verified-badge" title="This employer was reviewed by Titonova">✓ Titonova reviewed</span>}</div></div><span className="badge">{job.work_type.replaceAll("_", " ")}</span></div>
          {employer?.employer_verified && <p className="trust-copy">Titonova has reviewed this employer’s company details.</p>}
          <div className="job-detail-pay">{pay} {job.pay_min !== null || job.pay_max !== null ? <span>{job.pay_period === "month" ? "/ month" : job.pay_period === "hour" ? "/ hour" : job.pay_period === "project" ? "/ project" : ""}</span> : null}</div>
          <div className="tag-row"><span className="tag">{job.work_mode}</span><span className="tag">{job.experience_level === "any" ? "Any experience" : `${job.experience_level} level`}</span></div><h2 style={{ fontSize: 17, margin: "28px 0 10px" }}>About the role</h2><p style={{ color: "var(--muted)", fontSize: 14, lineHeight: 1.8, whiteSpace: "pre-wrap" }}>{job.description}</p>
        </article>
        <aside className="dashboard-card" style={{ marginTop: 0, alignSelf: "start" }}>
          <h2 style={{ margin: "0 0 8px", fontSize: 17 }}>Interested in this role?</h2><p style={{ color: "var(--muted)", fontSize: 12, lineHeight: 1.6 }}>Introduce yourself and explain why you’re a good fit. One application per member.</p>
          {errorCode === "duplicate" && <div className="form-alert">You’ve already applied to this role.</div>}
          {errorCode === "invalid" && <div className="form-alert">Add an introduction between 20 and 5,000 characters.</div>}
          {errorCode === "apply" && <div className="form-alert">Your application couldn’t be sent. Please try again.</div>}
          {errorCode === "freelancer-only" && <div className="form-alert">Applications are for freelancer accounts. Sign in with a job seeker profile to apply.</div>}
          {!user && <Link className="button full" href={`/login?next=${encodeURIComponent(`/jobs/${job.id}`)}`}>Log in to apply →</Link>}
          {user && profile?.role === "freelancer" && <form action={applyToJob} className="auth-form"><input type="hidden" name="job_id" value={job.id} /><label htmlFor="cover_note">Short introduction</label><textarea className="cover-note" id="cover_note" name="cover_note" minLength={20} maxLength={5000} required placeholder="Tell the employer about your relevant skills and experience…" /><button className="button full" type="submit">Submit application →</button></form>}
          {user && profile?.role === "employer" && <div className="setup-alert">Employer accounts can’t apply to job listings.</div>}
          {user && profile?.role === "admin" && <div className="setup-alert">Administrator accounts can review this listing but don’t apply to jobs.</div>}
          {reportCode === "sent" && <div className="setup-alert" role="status">Thanks. Your report was sent to the Titonova review team.</div>}
          {reportCode === "duplicate" && <div className="form-alert" role="status">You have already reported this listing.</div>}
          {reportCode === "error" && <div className="form-alert" role="alert">We couldn’t send your report. Please try again.</div>}
          {reportCode === "invalid" && <div className="form-alert" role="alert">Choose a reason and keep your note under 1,500 characters.</div>}
          {reportCode === "unavailable" && <div className="form-alert" role="status">This listing can’t be reported from this account.</div>}
          {!user && <p className="report-signin">Think this listing needs a review? <Link href={`/login?next=${encodeURIComponent(`/jobs/${job.id}`)}`}>Sign in to report it</Link>.</p>}
          {user && profile?.role !== "admin" && job.employer_id !== user.id && <details className="report-job-details"><summary>Report this listing</summary><p>Tell us what looks wrong. Reports go to the Titonova review team.</p><form action={reportJob} className="auth-form"><input type="hidden" name="job_id" value={job.id} /><label htmlFor="report-reason">Reason</label><select id="report-reason" name="reason" required defaultValue=""><option value="" disabled>Select a reason</option><option value="misleading">Misleading information</option><option value="spam">Spam or duplicate</option><option value="suspicious">Suspicious activity</option><option value="inappropriate">Inappropriate content</option><option value="other">Other</option></select><label htmlFor="report-details">Additional details (optional)</label><textarea className="cover-note" id="report-details" name="details" maxLength={1500} placeholder="Share a short explanation" /><button className="button secondary full" type="submit">Send report</button></form></details>}
        </aside>
      </div>
    </main>
  </div>;
}
