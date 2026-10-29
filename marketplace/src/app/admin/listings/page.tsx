import Link from "next/link";
import { adminDeleteJob, adminSetJobStatus } from "@/app/admin/content-actions";
import { PortalShell } from "@/components/portal-shell";
import { requireAdminContext } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };
const one = (value: string | string[] | undefined) => Array.isArray(value) ? value[0] ?? "" : value ?? "";
const date = (value: string) => new Date(value).toLocaleDateString("en-NP");

export default async function AdminListingsPage({ searchParams }: Props) {
  const { sessionClient } = await requireAdminContext();
  const params = await searchParams;
  const page = Math.max(1, Math.min(10000, Number.parseInt(one(params.page) || "1", 10) || 1));
  const pageSize = 50;
  const [{ data: jobs, error: jobsError }, { count }] = await Promise.all([
    sessionClient.from("jobs").select("id,title,description,category,location,work_type,currency,pay_min,pay_max,status,created_at,employer:profiles!jobs_employer_id_fkey(full_name,company_name)").order("created_at", { ascending: false }).range((page - 1) * pageSize, page * pageSize - 1),
    sessionClient.from("jobs").select("id", { count: "exact", head: true }),
  ]);
  const totalPages = Math.max(1, Math.ceil((count ?? 0) / pageSize));
  const success = one(params.success);
  const errorKey = one(params.error);

  return <PortalShell role="admin" activePath="/admin/listings">
    <div className="eyebrow">Platform administration</div><h1>All job posts</h1>
    <p style={{ color: "var(--muted)", fontSize: 13 }}>View every listing, change its status, or remove a post. Removing a post also removes its applications.</p>
    {success === "updated" && <div className="setup-alert" style={{ marginTop: 16 }}>The listing status was updated.</div>}
    {success === "deleted" && <div className="setup-alert" style={{ marginTop: 16 }}>The job post and its applications were removed.</div>}
    {errorKey && <div className="form-alert" style={{ marginTop: 16 }}>{errorKey === "confirm" ? "Type DELETE to confirm removal." : errorKey === "invalid" ? "Choose a valid listing status." : "That change could not be saved. Reload and try again."}</div>}
    {jobsError ? <div className="form-alert">The listings could not be loaded. Try again.</div> : !jobs?.length ? <section className="dashboard-card"><h2 style={{ marginTop: 0 }}>No job posts yet</h2><p style={{ color: "var(--muted)", fontSize: 13 }}>New employer submissions will appear here.</p></section> : <div className="admin-account-list">
      {jobs.map((job) => {
        const employer = Array.isArray(job.employer) ? job.employer[0] : job.employer;
        const pay = job.pay_min === null && job.pay_max === null ? "Pay discussed" : `${job.currency} ${job.pay_min ?? "—"}–${job.pay_max ?? "—"}`;
        return <article className="dashboard-card admin-member-card" key={job.id}>
          <div className="admin-member-heading"><div><strong>{job.title}</strong><span>{employer?.company_name || employer?.full_name || "Employer"} · {job.category} · {job.location}</span></div><span className={`status-tag status-${job.status}`}>{job.status.replaceAll("_", " ")}</span></div>
          <p className="admin-member-meta">{job.work_type.replaceAll("_", " ")} · {pay} · Submitted {date(job.created_at)}</p>
          <p className="admin-content-copy">{job.description}</p>
          <form action={adminSetJobStatus} className="admin-inline-form"><input type="hidden" name="job_id" value={job.id} /><label htmlFor={`job-status-${job.id}`}>Listing status</label><select id={`job-status-${job.id}`} name="status" defaultValue={job.status}><option value="draft">Draft</option><option value="pending_review">Pending review</option><option value="published">Published</option><option value="closed">Closed</option><option value="rejected">Rejected</option></select><button className="button small" type="submit">Save status</button></form>
          <details className="admin-delete-details"><summary>Remove this job post</summary><form action={adminDeleteJob} className="admin-delete-row"><input type="hidden" name="job_id" value={job.id} /><label htmlFor={`delete-job-${job.id}`}>Type DELETE to permanently remove this post and its applications</label><input id={`delete-job-${job.id}`} name="confirmation" required pattern="DELETE" title="Type DELETE exactly" /><button className="button small danger" type="submit">Remove post</button></form></details>
        </article>;
      })}
    </div>}
    <nav className="admin-pagination" aria-label="Job post pages">{page > 1 && <Link className="button secondary small" href={`/admin/listings?page=${page - 1}`}>← Previous</Link>}<span>Page {page} of {totalPages}</span>{page < totalPages && <Link className="button secondary small" href={`/admin/listings?page=${page + 1}`}>Next →</Link>}</nav>
  </PortalShell>;
}
