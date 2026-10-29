import Link from "next/link";
import { adminSetReportStatus } from "@/app/admin/content-actions";
import { PortalShell } from "@/components/portal-shell";
import { requireAdminContext } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };
const one = (value: string | string[] | undefined) => Array.isArray(value) ? value[0] ?? "" : value ?? "";
const date = (value: string) => new Date(value).toLocaleString("en-NP");
const reportReasons: Record<string, string> = { misleading: "Misleading information", spam: "Spam or duplicate", suspicious: "Suspicious activity", inappropriate: "Inappropriate content", other: "Other" };

export default async function AdminReportsPage({ searchParams }: Props) {
  const { sessionClient } = await requireAdminContext();
  const params = await searchParams;
  const requestedStatus = one(params.status);
  const status = ["open", "resolved", "dismissed"].includes(requestedStatus) ? requestedStatus : "open";
  const page = Math.max(1, Math.min(10000, Number.parseInt(one(params.page) || "1", 10) || 1));
  const pageSize = 30;
  let query = sessionClient.from("job_reports").select("id,job_id,reporter_id,reason,details,status,created_at,reviewed_at,job:jobs!job_reports_job_id_fkey(id,title,status,employer:profiles!jobs_employer_id_fkey(full_name,company_name)),reporter:profiles!job_reports_reporter_id_fkey(full_name,role)").eq("status", status).order("created_at", { ascending: false }).range((page - 1) * pageSize, page * pageSize - 1);
  let countQuery = sessionClient.from("job_reports").select("id", { count: "exact", head: true }).eq("status", status);
  const [{ data: reports, error }, { count }] = await Promise.all([query, countQuery]);
  const totalPages = Math.max(1, Math.ceil((count ?? 0) / pageSize));
  const success = one(params.success);
  const errorKey = one(params.error);

  return <PortalShell role="admin" activePath="/admin/reports">
    <div className="eyebrow">Trust and safety</div><h1>Job reports</h1>
    <p style={{ color: "var(--muted)", fontSize: 13 }}>Review member reports and update the moderation status. Changing a report status does not automatically change or remove the job listing.</p>
    {success === "updated" && <div className="setup-alert" style={{ marginTop: 16 }}>Report status updated.</div>}
    {errorKey && <div className="form-alert" style={{ marginTop: 16 }}>{errorKey === "invalid" ? "Choose a valid report status." : "The report could not be updated. Refresh and try again."}</div>}
    <nav className="admin-view-tabs" aria-label="Report status">
      {(["open", "resolved", "dismissed"] as const).map((value) => <Link key={value} className={status === value ? "active" : ""} href={`/admin/reports?status=${value}`}>{value[0].toUpperCase() + value.slice(1)}</Link>)}
    </nav>
    {error ? <div className="form-alert">Reports could not be loaded. Confirm the trust and moderation database update has been applied.</div> : !reports?.length ? <section className="dashboard-card"><h2 style={{ marginTop: 0 }}>No {status} reports</h2><p style={{ color: "var(--muted)", fontSize: 13 }}>Member reports will appear here.</p></section> : <div className="admin-account-list">
      {reports.map((report) => {
        const job = Array.isArray(report.job) ? report.job[0] : report.job;
        const reporter = Array.isArray(report.reporter) ? report.reporter[0] : report.reporter;
        const employer = job && (Array.isArray(job.employer) ? job.employer[0] : job.employer);
        return <article className="dashboard-card admin-member-card" key={report.id}>
          <div className="admin-member-heading"><div><strong>{job?.title || "Job listing removed"}</strong><span>{employer?.company_name || employer?.full_name || "Employer"} · Reported by {reporter?.full_name || "Member"}</span></div><span className={`status-tag status-${report.status}`}>{report.status}</span></div>
          <p className="admin-member-meta">{reportReasons[report.reason] || "Other"} · {date(report.created_at)}</p>
          {report.details && <p className="admin-content-copy">{report.details}</p>}
          {job && <p className="admin-member-meta"><Link href={`/jobs/${job.id}`}>Open job listing →</Link></p>}
          <form action={adminSetReportStatus} className="admin-inline-form"><input type="hidden" name="report_id" value={report.id} /><label htmlFor={`report-status-${report.id}`}>Report status</label><select id={`report-status-${report.id}`} name="status" defaultValue={report.status}><option value="open">Open</option><option value="resolved">Resolved</option><option value="dismissed">Dismissed</option></select><button className="button small" type="submit">Save status</button></form>
        </article>;
      })}
    </div>}
    <nav className="admin-pagination" aria-label="Report pages">{page > 1 && <Link className="button secondary small" href={`/admin/reports?status=${status}&page=${page - 1}`}>← Previous</Link>}<span>Page {page} of {totalPages}</span>{page < totalPages && <Link className="button secondary small" href={`/admin/reports?status=${status}&page=${page + 1}`}>Next →</Link>}</nav>
  </PortalShell>;
}
