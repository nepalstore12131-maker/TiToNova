import Link from "next/link";
import { adminSetApplicationStatus } from "@/app/admin/content-actions";
import { PortalShell } from "@/components/portal-shell";
import { requireAdminContext } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };
const one = (value: string | string[] | undefined) => Array.isArray(value) ? value[0] ?? "" : value ?? "";
const date = (value: string) => new Date(value).toLocaleDateString("en-NP");

export default async function AdminApplicationsPage({ searchParams }: Props) {
  const { sessionClient } = await requireAdminContext();
  const params = await searchParams;
  const page = Math.max(1, Math.min(10000, Number.parseInt(one(params.page) || "1", 10) || 1));
  const pageSize = 50;
  const [{ data: applications, error: applicationsError }, { count }] = await Promise.all([
    sessionClient.from("applications").select("id,status,cover_note,created_at,job:jobs!applications_job_id_fkey(id,title,employer:profiles!jobs_employer_id_fkey(full_name,company_name)),applicant:profiles!applications_applicant_id_fkey(full_name,headline,location)").order("created_at", { ascending: false }).range((page - 1) * pageSize, page * pageSize - 1),
    sessionClient.from("applications").select("id", { count: "exact", head: true }),
  ]);
  const totalPages = Math.max(1, Math.ceil((count ?? 0) / pageSize));
  const success = one(params.success);
  const errorKey = one(params.error);

  return <PortalShell role="admin" activePath="/admin/applications">
    <div className="eyebrow">Platform administration</div><h1>Applications</h1>
    <p style={{ color: "var(--muted)", fontSize: 13 }}>Review submitted introductions and manage application status across the marketplace.</p>
    {success === "updated" && <div className="setup-alert" style={{ marginTop: 16 }}>The application status was updated.</div>}
    {errorKey && <div className="form-alert" style={{ marginTop: 16 }}>{errorKey === "invalid" ? "Choose a valid application status." : "The application could not be updated. Reload and try again."}</div>}
    {applicationsError ? <div className="form-alert">The applications could not be loaded. Try again.</div> : !applications?.length ? <section className="dashboard-card"><h2 style={{ marginTop: 0 }}>No applications yet</h2><p style={{ color: "var(--muted)", fontSize: 13 }}>Applications will appear here when job seekers apply.</p></section> : <div className="admin-account-list">
      {applications.map((application) => {
        const job = Array.isArray(application.job) ? application.job[0] : application.job;
        const applicant = Array.isArray(application.applicant) ? application.applicant[0] : application.applicant;
        const employer = job && (Array.isArray(job.employer) ? job.employer[0] : job.employer);
        return <article className="dashboard-card admin-member-card" key={application.id}>
          <div className="admin-member-heading"><div><strong>{applicant?.full_name || "Job seeker"}</strong><span>{applicant?.headline || ""}{applicant?.location ? ` · ${applicant.location}` : ""}</span></div><span className={`status-tag status-${application.status}`}>{application.status}</span></div>
          <p className="admin-member-meta">Applied for <strong>{job?.title || "Job post removed"}</strong>{employer?.company_name || employer?.full_name ? ` · ${employer.company_name || employer.full_name}` : ""} · {date(application.created_at)}</p>
          <div className="admin-content-copy">{application.cover_note}</div>
          <form action={adminSetApplicationStatus} className="admin-inline-form"><input type="hidden" name="application_id" value={application.id} /><label htmlFor={`application-status-${application.id}`}>Application status</label><select id={`application-status-${application.id}`} name="status" defaultValue={application.status}><option value="submitted">Submitted</option><option value="shortlisted">Shortlisted</option><option value="rejected">Rejected</option><option value="withdrawn">Withdrawn</option></select><button className="button small" type="submit">Save status</button></form>
        </article>;
      })}
    </div>}
    <nav className="admin-pagination" aria-label="Application pages">{page > 1 && <Link className="button secondary small" href={`/admin/applications?page=${page - 1}`}>← Previous</Link>}<span>Page {page} of {totalPages}</span>{page < totalPages && <Link className="button secondary small" href={`/admin/applications?page=${page + 1}`}>Next →</Link>}</nav>
  </PortalShell>;
}
