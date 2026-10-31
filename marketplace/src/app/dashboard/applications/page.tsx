import {CandidateSummary} from '@/components/workflow/candidate-summary';
import {NextStep} from "@/components/workflow/next-step";
import {applicationStep} from "@/lib/workflow";
import styles from "@/components/workflow/workflow.module.css";
import Link from "next/link";
import { redirect } from "next/navigation";
import { PortalShell, type AccountRole } from "@/components/portal-shell";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

const date = (value: string) => new Date(value).toLocaleDateString("en-NP");

export default async function ApplicationsPage() {
  const supabase = await createClient();
  if (!supabase) return <main className="dashboard"><div className="setup-alert">Connect the shared database to view applications.</div></main>;
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const { data: profile, error: profileError } = await supabase.from("profiles").select("role,employer_premium_until").eq("id", user.id).maybeSingle();
  if (profileError || !profile) return <main className="dashboard"><div className="form-alert" role="alert">We couldn’t load your account details. Refresh the page and try again.</div></main>;
  const role = profile.role as AccountRole;
  if (role === "admin") redirect("/admin");
  const employerPremiumActive = role === "employer" && Boolean(profile.employer_premium_until && new Date(profile.employer_premium_until).getTime() > Date.now());
  if (role === "employer" && !employerPremiumActive) return <PortalShell role="employer" activePath="/dashboard/applications">
    <div className="eyebrow">Hiring workspace</div><h1>Applications received</h1>
    <section className="dashboard-card"><h2 style={{ marginTop: 0 }}>Premium required</h2><p style={{ color: "var(--muted)", fontSize: 13 }}>Activate Employer Premium to review candidates and manage applications. Existing candidates and applications will be available after approval.</p><Link className="button" href="/dashboard/billing">View payment details →</Link></section>
  </PortalShell>;

  let applications: any[] = [];
  let loadFailed = false;
  if (role === "employer") {
    const result = await supabase.from("applications").select("id,applicant_id,status,hiring_stage,created_at,job:jobs!applications_job_id_fkey(id,title),applicant:profiles!applications_applicant_id_fkey(full_name,headline)").order("created_at", { ascending: false }).limit(100);
    loadFailed = Boolean(result.error);
    applications = result.data ?? [];
  } else {
    const result = await supabase.from("applications").select("id,applicant_id,status,hiring_stage,created_at,job:jobs!applications_job_id_fkey(id,title,location)").eq("applicant_id", user.id).order("created_at", { ascending: false }).limit(100);
    loadFailed = Boolean(result.error);
    applications = result.data ?? [];
  }

  const ids=applications.map(a=>a.id);
  const assignmentResult=ids.length?await supabase.from("job_assignments").select("id,application_id,state,agreement_required").in("application_id",ids).order("created_at",{ascending:false}):{data:[],error:null};
  const assignments=new Map<string,any>();
  for(const work of assignmentResult.data||[])if(!assignments.has(work.application_id))assignments.set(work.application_id,work);
  return <PortalShell role={role} activePath="/dashboard/applications">
    <div className="eyebrow">{role === "employer" ? "Hiring workspace" : "Your job search"}</div>
    <h1>{role === "employer" ? "Applications received" : "My applications"}</h1>
    <p style={{ color: "var(--muted)", fontSize: 13 }}>{role === "employer" ? "Follow each candidate’s next step below. New updates are marked in the Work menu." : "Follow your application here. Each card shows whether to wait, respond or continue in My work."}</p>
    {loadFailed ? <div className="form-alert" role="alert">We couldn’t load applications. Refresh the page and try again.</div> : !applications.length ? <section className="dashboard-card"><h2 style={{ marginTop: 0 }}>No applications yet</h2><p style={{ color: "var(--muted)", fontSize: 13 }}>{role === "employer" ? "Applications to your published jobs will appear here." : "Find a role that fits and send your first application."}</p>{role === "freelancer" && <Link className="button" href="/jobs">Browse jobs →</Link>}</section> :
      <div className={styles.cards}>
        {applications.map((application) => {
          const job = Array.isArray(application.job) ? application.job[0] : application.job;
          const applicant = "applicant" in application ? (Array.isArray(application.applicant) ? application.applicant[0] : application.applicant) : null;
          const flow=applicationStep(application.id,application.status,application.hiring_stage,role==='employer',assignments.get(application.id));
          return <article className={styles.card} key={application.id}>{role==='employer'?<CandidateSummary id={application.applicant_id} name={applicant?.full_name||'Applicant'}/>:<h2>{job?.title||'Job listing'}</h2>}<p>{role==='employer'?job?.title:job?.location}</p><small>Applied {date(application.created_at)}</small>{assignmentResult.error?<p className="form-alert">Work status could not be loaded. <Link href={`/dashboard/applications/${application.id}`}>Open application to check →</Link></p>:<NextStep flow={flow} compact/>}</article>;
        })}
      </div>}
    {applications.length===100&&<p>Showing the 100 most recent applications.</p>}
  </PortalShell>;
}
