import Link from "next/link";
import { adminSetEmployerReview } from "@/app/admin/content-actions";
import { PortalShell } from "@/components/portal-shell";
import { requireAdminContext } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };
const one = (value: string | string[] | undefined) => Array.isArray(value) ? value[0] ?? "" : value ?? "";
const date = (value?: string | null) => value ? new Date(value).toLocaleDateString("en-NP") : "Not yet reviewed";

export default async function AdminEmployersPage({ searchParams }: Props) {
  const { sessionClient } = await requireAdminContext();
  const params = await searchParams;
  const page = Math.max(1, Math.min(10000, Number.parseInt(one(params.page) || "1", 10) || 1));
  const pageSize = 30;
  const showReviewed = one(params.view) === "reviewed";
  const [{ data: employers, error }, { count }] = await Promise.all([
    sessionClient.from("profiles").select("id,full_name,company_name,headline,bio,location,portfolio_url,linkedin_url,created_at,employer_verified,employer_verified_at").eq("role", "employer").eq("employer_verified", showReviewed).order("created_at", { ascending: false }).range((page - 1) * pageSize, page * pageSize - 1),
    sessionClient.from("profiles").select("id", { count: "exact", head: true }).eq("role", "employer").eq("employer_verified", showReviewed),
  ]);
  const totalPages = Math.max(1, Math.ceil((count ?? 0) / pageSize));
  const success = one(params.success);
  const errorKey = one(params.error);

  return <PortalShell role="admin" activePath="/admin/employers">
    <div className="eyebrow">Trust and safety</div><h1>Employer review</h1>
    <p style={{ color: "var(--muted)", fontSize: 13 }}>Review company details before displaying the “Titonova reviewed” signal on public job listings. Confirm the business and its contact details before marking a profile reviewed.</p>
    {success === "reviewed" && <div className="setup-alert" style={{ marginTop: 16 }}>Employer marked as Titonova reviewed.</div>}
    {success === "unreviewed" && <div className="setup-alert" style={{ marginTop: 16 }}>The review signal was removed.</div>}
    {errorKey && <div className="form-alert" style={{ marginTop: 16 }}>{errorKey === "invalid" ? "Choose a valid employer." : "That employer could not be updated. Refresh and try again."}</div>}
    <nav className="admin-view-tabs" aria-label="Employer review status">
      <Link className={!showReviewed ? "active" : ""} href="/admin/employers">Needs review</Link>
      <Link className={showReviewed ? "active" : ""} href="/admin/employers?view=reviewed">Reviewed</Link>
    </nav>
    {error ? <div className="form-alert">Employer accounts could not be loaded. Confirm the trust and moderation database update has been applied.</div> : !employers?.length ? <section className="dashboard-card"><h2 style={{ marginTop: 0 }}>{showReviewed ? "No reviewed employers yet" : "Review queue is clear"}</h2><p style={{ color: "var(--muted)", fontSize: 13 }}>Employer accounts will appear here.</p></section> : <div className="admin-account-list">
      {employers.map((employer) => <article className="dashboard-card admin-member-card" key={employer.id}>
        <div className="admin-member-heading"><div><strong>{employer.company_name || employer.full_name || "Unnamed employer"}</strong><span>{employer.full_name}{employer.location ? ` · ${employer.location}` : ""}</span></div><span className={employer.employer_verified ? "verified-badge" : "status-tag status-pending_review"}>{employer.employer_verified ? "Titonova reviewed" : "Needs review"}</span></div>
        {employer.headline && <p className="admin-member-meta">{employer.headline}</p>}
        {employer.bio && <p className="admin-content-copy">{employer.bio}</p>}
        {(employer.portfolio_url || employer.linkedin_url) && <p className="admin-member-meta">{employer.portfolio_url && <a href={employer.portfolio_url} target="_blank" rel="noreferrer">Website or portfolio ↗</a>}{employer.portfolio_url && employer.linkedin_url ? " · " : ""}{employer.linkedin_url && <a href={employer.linkedin_url} target="_blank" rel="noreferrer">LinkedIn ↗</a>}</p>}
        <p className="admin-member-meta">Joined {date(employer.created_at)} · {employer.employer_verified ? `Reviewed ${date(employer.employer_verified_at)}` : "No public review signal is shown"}</p>
        <form action={adminSetEmployerReview} className="admin-inline-form"><input type="hidden" name="employer_id" value={employer.id} /><input type="hidden" name="reviewed" value={employer.employer_verified ? "false" : "true"} /><button className={employer.employer_verified ? "button small secondary" : "button small"} type="submit">{employer.employer_verified ? "Remove review signal" : "Mark reviewed"}</button></form>
      </article>)}
    </div>}
    <nav className="admin-pagination" aria-label="Employer pages">{page > 1 && <Link className="button secondary small" href={`/admin/employers?view=${showReviewed ? "reviewed" : ""}&page=${page - 1}`}>← Previous</Link>}<span>Page {page} of {totalPages}</span>{page < totalPages && <Link className="button secondary small" href={`/admin/employers?view=${showReviewed ? "reviewed" : ""}&page=${page + 1}`}>Next →</Link>}</nav>
  </PortalShell>;
}
