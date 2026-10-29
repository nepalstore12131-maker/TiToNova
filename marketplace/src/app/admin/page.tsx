import Link from "next/link";
import { redirect } from "next/navigation";
import { PortalShell } from "@/components/portal-shell";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function AdminPage() {
  const supabase = await createClient();
  if (!supabase) return <main className="dashboard"><div className="setup-alert">Connect the shared database to open the administrator workspace.</div></main>;
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/admin/login");
  const { data: profile } = await supabase.from("profiles").select("full_name,role").eq("id", user.id).maybeSingle();
  if (profile?.role !== "admin") redirect("/dashboard?error=admin-only");
  const [{ count: pendingJobs }, { count: publishedJobs }, { count: members }, { count: unreviewedEmployers, error: employerReviewError }, { count: openReports, error: reportsError }, { count: pendingPayments, error: paymentsError }] = await Promise.all([
    supabase.from("jobs").select("id", { count: "exact", head: true }).eq("status", "pending_review"),
    supabase.from("jobs").select("id", { count: "exact", head: true }).eq("status", "published"),
    supabase.from("profiles").select("id", { count: "exact", head: true }),
    supabase.from("profiles").select("id", { count: "exact", head: true }).eq("role", "employer").eq("employer_verified", false),
    supabase.from("job_reports").select("id", { count: "exact", head: true }).eq("status", "open"),
    supabase.from("employer_payment_requests").select("id", { count: "exact", head: true }).eq("status", "pending"),
  ]);
  const trustToolsReady = !employerReviewError && !reportsError;
  const paymentsReady = !paymentsError;

  return <PortalShell role="admin" activePath="/admin">
    <div className="eyebrow">Platform administration</div><h1>Welcome{profile?.full_name ? `, ${profile.full_name}` : ""}</h1>
    <p style={{ color: "var(--muted)", fontSize: 13 }}>Review job listings before they are visible to members.</p>
    <div className="portal-card-grid"><Link className="portal-action-card" href="/admin/jobs"><strong>{pendingJobs ?? 0} listings awaiting review →</strong><span>Approve or reject employer submissions.</span></Link><Link className="portal-action-card" href="/admin/listings"><strong>{publishedJobs ?? 0} published jobs →</strong><span>View and manage every job post and its status.</span></Link><Link className="portal-action-card" href="/admin/employers"><strong>{trustToolsReady ? `${unreviewedEmployers ?? 0} employers need review →` : "Set up trust tools →"}</strong><span>{trustToolsReady ? "Review company details and add a public trust signal." : "Apply the trust and moderation database update to enable employer reviews."}</span></Link><Link className="portal-action-card" href="/admin/reports"><strong>{trustToolsReady ? `${openReports ?? 0} open job reports →` : "Set up trust tools →"}</strong><span>{trustToolsReady ? "Read member reports and decide whether to resolve or dismiss them." : "Apply the trust and moderation database update to enable job reports."}</span></Link><Link className="portal-action-card" href="/admin/payments"><strong>{paymentsReady ? `${pendingPayments ?? 0} payments to review →` : "Set up Premium payments →"}</strong><span>{paymentsReady ? "Review payment references and private proof, then manage employer access." : "Apply the employer Premium payment update to enable manual billing."}</span></Link><Link className="portal-action-card" href="/admin/payments/settings"><strong>Premium plan and payment accounts →</strong><span>Set the displayed price, access period, and payment instructions.</span></Link><Link className="portal-action-card" href="/admin/users"><strong>{members ?? 0} accounts →</strong><span>Change account details and access, reset passwords, create or remove accounts.</span></Link><Link className="portal-action-card" href="/admin/applications"><strong>Applications →</strong><span>Review application details and update their status.</span></Link></div>
  </PortalShell>;
}
