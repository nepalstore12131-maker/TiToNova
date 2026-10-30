import { redirect } from "next/navigation";
import { reviewJob } from "@/app/jobs/actions";
import { PortalShell } from "@/components/portal-shell";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };
const one = (value: string | string[] | undefined) => Array.isArray(value) ? value[0] ?? "" : value ?? "";
const date = (value: string) => new Date(value).toLocaleDateString("en-NP");

export default async function AdminJobsPage({ searchParams }: Props) {
  const supabase = await createClient();
  if (!supabase) return <main className="dashboard"><div className="setup-alert">Connect the shared database to review jobs.</div></main>;
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/admin/login");
  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).maybeSingle();
  if (profile?.role !== "admin") redirect("/dashboard?error=admin-only");
  const [{ data: jobs }, params] = await Promise.all([
    supabase.from("jobs").select("id,title,description,category,location,work_type,pay_min,pay_max,currency,created_at,employer:profiles!jobs_employer_id_fkey(full_name,company_name)").eq("status", "pending_review").order("created_at", { ascending: true }),
    searchParams,
  ]);

  return <PortalShell role="admin" activePath="/admin/jobs">
    <div className="eyebrow">Moderation</div><h1>Job review queue</h1><p style={{ color: "var(--muted)", fontSize: 13 }}>Review paused listings before restoring them. Approval dismisses their current open reports; rejection resolves them.</p>
    {one(params.success) === "reviewed" && <div className="setup-alert">The review decision was saved.</div>}
    {one(params.error) && <div className="form-alert">We couldn’t save that decision. The job may already have been reviewed.</div>}
    {!jobs?.length ? <section className="dashboard-card"><h2 style={{ marginTop: 0 }}>The queue is clear</h2><p style={{ color: "var(--muted)", fontSize: 13 }}>Reported listings and posts requiring approval will appear here.</p></section> : <div className="dashboard-list">
      {jobs.map((job) => {
        const employer = Array.isArray(job.employer) ? job.employer[0] : job.employer;
        const pay = job.pay_min === null && job.pay_max === null ? "Pay discussed" : `${job.currency} ${job.pay_min ?? "—"}–${job.pay_max ?? "—"}`;
        return <article className="dashboard-card admin-review-row" key={job.id}><div><div className="eyebrow">{job.category} · {job.work_type.replaceAll("_", " ")}</div><h2 style={{ margin: "8px 0", fontSize: 20 }}>{job.title}</h2><div style={{ color: "var(--muted)", fontSize: 12 }}>{employer?.company_name || employer?.full_name || "Employer"} · {job.location} · {pay}</div><p>{job.description}</p><small style={{ color: "var(--muted)" }}>Submitted {date(job.created_at)}</small></div><div className="review-buttons"><form action={reviewJob}><input type="hidden" name="job_id" value={job.id} /><input type="hidden" name="status" value="published" /><button className="button small" type="submit">Approve</button></form><form action={reviewJob}><input type="hidden" name="job_id" value={job.id} /><input type="hidden" name="status" value="rejected" /><button className="button small danger" type="submit">Reject</button></form></div></article>;
      })}
    </div>}
  </PortalShell>;
}
