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
  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).maybeSingle();
  const role = (profile?.role ?? "freelancer") as AccountRole;
  if (role === "admin") redirect("/admin");

  let applications: any[] = [];
  if (role === "employer") {
    const result = await supabase.from("applications").select("id,status,created_at,job:jobs!applications_job_id_fkey(id,title),applicant:profiles!applications_applicant_id_fkey(full_name,headline)").order("created_at", { ascending: false }).limit(100);
    applications = result.data ?? [];
  } else {
    const result = await supabase.from("applications").select("id,status,created_at,job:jobs!applications_job_id_fkey(id,title,location)").eq("applicant_id", user.id).order("created_at", { ascending: false }).limit(100);
    applications = result.data ?? [];
  }

  return <PortalShell role={role} activePath="/dashboard/applications">
    <div className="eyebrow">{role === "employer" ? "Hiring workspace" : "Your job search"}</div>
    <h1>{role === "employer" ? "Applications received" : "My applications"}</h1>
    <p style={{ color: "var(--muted)", fontSize: 13 }}>{role === "employer" ? "Open an application to review the candidate’s introduction and update its status." : "Open an application to see its details and current status."}</p>
    {!applications?.length ? <section className="dashboard-card"><h2 style={{ marginTop: 0 }}>No applications yet</h2><p style={{ color: "var(--muted)", fontSize: 13 }}>{role === "employer" ? "Applications to your published jobs will appear here." : "Find a role that fits and send your first application."}</p>{role === "freelancer" && <Link className="button" href="/jobs">Browse jobs →</Link>}</section> :
      <div className="portal-table"><table><thead><tr><th>{role === "employer" ? "Candidate" : "Job"}</th><th>{role === "employer" ? "Job" : "Location"}</th><th>Status</th><th>Submitted</th><th></th></tr></thead><tbody>
        {applications.map((application) => {
          const job = Array.isArray(application.job) ? application.job[0] : application.job;
          const applicant = "applicant" in application ? (Array.isArray(application.applicant) ? application.applicant[0] : application.applicant) : null;
          return <tr key={application.id}><td><strong>{role === "employer" ? applicant?.full_name || "Freelancer" : job?.title || "Job listing"}</strong>{role === "employer" && applicant?.headline && <small style={{ display: "block", marginTop: 4, color: "var(--muted)" }}>{applicant.headline}</small>}</td><td>{role === "employer" ? job?.title || "Job listing" : job?.location || "—"}</td><td><span className={`status-tag status-${application.status}`}>{application.status}</span></td><td>{date(application.created_at)}</td><td><Link href={`/dashboard/applications/${application.id}`}>View →</Link></td></tr>;
        })}
      </tbody></table></div>}
  </PortalShell>;
}
