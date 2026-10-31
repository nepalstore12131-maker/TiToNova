import type { Metadata } from "next";
import { publicMetadata } from "@/lib/seo";
import {ApplicationWindowInfo} from "@/components/application-window";
import {applicationAvailability} from "@/lib/application-window";
import {SampleLinks} from "@/components/sample-links";
import {parseSamples} from "@/lib/work-samples";
import {AccountSubmit} from "@/components/account-form-controls";
import { ProfileAvatar } from "@/components/profile-avatar";
import { BrandMark } from "@/components/brand-mark";
import Link from "next/link";
import { formatNpr } from "@/lib/discovery";
import { notFound } from "next/navigation";
import { applyToJob, reportJob } from "@/app/jobs/actions";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ id: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) return { title: "Job not found | Titonova", robots: { index: false } };
  const db = await createClient();
  const result = db ? await db.from("jobs").select("title,description,location").eq("id", id).eq("status", "published").maybeSingle() : null;
  const job = result?.data;
  if (!job) return { title: "Job unavailable | Titonova", robots: { index: false } };
  const description = job.description.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim().slice(0, 160);
  return publicMetadata(`${job.title}${job.location ? ` in ${job.location}` : ""} | Titonova`, description, `/jobs/${id}`);
}

export default async function JobDetailsPage({ params, searchParams }: Props) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const queryParams = await searchParams;
  const errorCode = Array.isArray(queryParams.error) ? queryParams.error[0] : queryParams.error;
  const reportCode = Array.isArray(queryParams.report) ? queryParams.report[0] : queryParams.report;
  const supabase = await createClient();
  if (!supabase) return <main className="dashboard"><div className="setup-alert">Job details will be available after the shared database is connected.</div><Link href="/jobs">Back to jobs</Link></main>;

  const { data: job, error: jobError } = await supabase.from("jobs").select("id,title,description,reference_links,applications_open_at,applications_close_at,urgent,worker_count,category,location,work_type,work_mode,experience_level,pay_period,currency,pay_min,pay_max,created_at,employer_id,employer:profiles!jobs_employer_id_fkey(full_name,company_name,employer_verified)").eq("id", id).eq("status", "published").maybeSingle();
  if (jobError) return <main className="dashboard"><div className="form-alert" role="alert">We couldn’t load this job. Refresh the page and try again.</div><Link href="/jobs">Back to jobs →</Link></main>;
  if (!job) notFound();
  const {data:filled,error:capacityError}=await supabase.rpc("job_filled_seats",{p_job:id});
  const { data: { user } } = await supabase.auth.getUser();
  const { data: profile } = user ? await supabase.from("profiles").select("role").eq("id", user.id).maybeSingle() : { data: null };
  const {data:library}=user&&profile?.role==='freelancer'?await supabase.from('candidate_sample_library').select('samples').eq('id',user.id).maybeSingle():{data:null};
  const sampleOptions=(library?.samples||'').split('\n').map((x:string)=>x.trim()).filter((x:string)=>x&&parseSamples(x));
  const employer = Array.isArray(job.employer) ? job.employer[0] : job.employer;
  const company = employer?.company_name || employer?.full_name || "Titonova employer";
  const accepting=!capacityError&&typeof filled==='number'&&filled<job.worker_count&&applicationAvailability(job)==='open';
  const pay = formatNpr(job.pay_min,job.pay_max,false,job.currency);

  return <div className="page-shell">
    <header className="site-header"><Link className="brand" href="/"><BrandMark /> Titonova</Link><nav className="nav-links"><Link href="/jobs">Browse jobs</Link><Link href="/dashboard">Dashboard</Link></nav><div className="nav-actions">{user ? <Link className="button" href="/dashboard">My workspace</Link> : <><Link className="text-button" href="/login">Log in</Link><Link className="button" href="/signup">Join Titonova</Link></>}</div></header>
    <main className="dashboard" style={{ maxWidth: 1100 }}>
      <p style={{ margin: "0 0 18px", fontSize: 12 }}><Link href="/jobs" style={{ color: "var(--green)" }}>← All jobs</Link></p>
      <div className="job-detail-grid">
        <article className="dashboard-card" style={{ marginTop: 0 }}>
          <div className="eyebrow">{job.category}</div><h1 style={{ marginTop: 10 }}>{job.title}</h1>
          <div className="job-meta" style={{ margin: "14px 0 22px" }}><div className="company"><ProfileAvatar id={job.employer_id} name={company} size={48}/><div><Link className="company-name" href={`/companies/${job.employer_id}`}>{company}</Link><span className="company-place">{job.location}</span>{employer?.employer_verified && <span className="verified-badge" title="This employer was reviewed by Titonova">✓ Titonova reviewed</span>}</div></div><span className="badge">{job.work_type.replaceAll("_", " ")}</span></div>
          {employer?.employer_verified && <p className="trust-copy">Titonova has reviewed this employer’s company details.</p>}
          <p>{capacityError?"Position availability is temporarily unavailable.":`${Math.max(0,job.worker_count-(filled||0))} of ${job.worker_count} positions available`} · advertised pay is per person.</p><ApplicationWindowInfo job={job}/>
          <div className="job-detail-pay">{pay} {job.pay_min !== null || job.pay_max !== null ? <span>{job.pay_period === "month" ? "/ month" : job.pay_period === "hour" ? "/ hour" : job.pay_period === "project" ? "/ project" : ""}</span> : null}</div>
          <div className="tag-row"><span className="tag">{job.work_mode}</span><span className="tag">{job.experience_level === "any" ? "Any experience" : `${job.experience_level} level`}</span></div><h2 style={{ fontSize: 17, margin: "28px 0 10px" }}>About the role</h2><p style={{ color: "var(--muted)", fontSize: 14, lineHeight: 1.8, whiteSpace: "pre-wrap" }}>{job.description}</p>
          {job.reference_links?.length>0&&<section><h2>Examples from the hirer</h2><p>Reference material to explain the task. Providing your own samples is optional.</p><SampleLinks links={job.reference_links}/></section>}
        </article>
        <aside className="dashboard-card" style={{ marginTop: 0, alignSelf: "start" }}>
          <h2 style={{ margin: "0 0 8px", fontSize: 17 }}>Interested in this role?</h2><p style={{ color: "var(--muted)", fontSize: 12, lineHeight: 1.6 }}>Introduce yourself and explain why you’re a good fit. One application per member.</p>
          {(!accepting||errorCode==="window")&&<div className="setup-alert">Applications are not open for this job right now. Check the opening and closing times.</div>}
          {errorCode === "duplicate" && <div className="form-alert">You’ve already applied to this role.</div>}
          {errorCode === "invalid" && <div className="form-alert">Add an introduction between 20 and 5,000 characters.</div>}
          {errorCode === "samples" && <div className="form-alert">Use up to 5 valid Google Drive or YouTube sample links.</div>}
          {errorCode === "apply" && <div className="form-alert">Your application couldn’t be sent. Please try again.</div>}
          {errorCode === "freelancer-only" && <div className="form-alert">Applications are for freelancer accounts. Sign in with a job seeker profile to apply.</div>}
          {!user && accepting && <Link className="button full" href={`/login?next=${encodeURIComponent(`/jobs/${job.id}`)}`}>Log in to apply →</Link>}
          {user && profile?.role === "freelancer" && accepting && <form action={applyToJob} className="auth-form"><input type="hidden" name="job_id" value={job.id} /><label htmlFor="cover_note">Short introduction</label><textarea className="cover-note" id="cover_note" name="cover_note" minLength={20} maxLength={5000} required placeholder="Tell the employer about your relevant skills and experience…" /><fieldset style={{border:'1px solid var(--line)',borderRadius:12,padding:14}}><legend>Share work samples (optional)</legend><p>Select only the links you want to share with this employer. Nothing is selected automatically.</p>{sampleOptions.map((url:string,i:number)=><label key={url} style={{display:'flex',gap:8,alignItems:'flex-start',margin:'12px 0'}}><input type="checkbox" name="sample_link" value={url}/><span style={{overflowWrap:'anywhere'}}>Sample {i+1} · {url}</span></label>)}{!sampleOptions.length&&<p>No saved demo links yet. You can apply without samples.</p>}<Link href="/dashboard/profile#work-samples" target="_blank" rel="noopener noreferrer">Manage saved sample links ↗</Link><small style={{display:'block'}}>Changes to your library do not change samples already shared. You can add or remove links later from the application.</small></fieldset><AccountSubmit pendingLabel="Applying…">Submit application →</AccountSubmit></form>}
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
