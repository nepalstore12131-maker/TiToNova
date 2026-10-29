import Link from "next/link";
import { redirect } from "next/navigation";
import { PortalShell, type AccountRole } from "@/components/portal-shell";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const supabase = await createClient();
  if (!supabase) return <div className="page-shell"><header className="site-header"><Link className="brand" href="/"><span className="brand-mark">↗</span> Titonova</Link></header><main className="dashboard"><div className="setup-alert">Connect the Supabase project to use your personal workspace.</div></main></div>;

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const { data: profile, error: profileError } = await supabase.from("profiles").select("full_name,company_name,role").eq("id", user.id).maybeSingle();
  if (profileError || !profile) return <main className="dashboard"><div className="form-alert" role="alert">We couldn’t load your account workspace. Refresh the page and try again.</div><Link href="/dashboard">Try again →</Link></main>;
  const role = profile.role as AccountRole;
  if (role === "admin") redirect("/admin");

  const displayName = profile?.full_name || user.email || "member";
  const [jobs, applications] = role === "employer"
    ? await Promise.all([
        supabase.from("jobs").select("id", { count: "exact", head: true }).eq("employer_id", user.id),
        supabase.from("applications").select("id", { count: "exact", head: true }),
      ])
    : [null, await supabase.from("applications").select("id", { count: "exact", head: true }).eq("applicant_id", user.id)];
  const jobCount = jobs?.error ? null : jobs?.count ?? 0;
  const applicationCount = applications.error ? null : applications.count ?? 0;

  const cards = role === "employer"
    ? [
        { href: "/dashboard/jobs", title: "My job posts", description: jobCount === null ? "Listing totals are temporarily unavailable. Open your job posts to check their status." : `${jobCount} listing${jobCount === 1 ? "" : "s"} · Check review status and manage roles.` },
        { href: "/dashboard/applications", title: "Applications received", description: applicationCount === null ? "Application totals are temporarily unavailable. Open the list to review candidates." : `${applicationCount} application${applicationCount === 1 ? "" : "s"} · Review interested candidates.` },
        { href: "/dashboard/jobs/new", title: "Post a job", description: "Share a role with professionals across Nepal." },
        { href: "/dashboard/profile", title: "Company profile", description: "Update the details candidates see about your team." },
      ]
    : [
        { href: "/jobs", title: "Browse jobs", description: "Search published roles by title, category, location and work type." },
        { href: "/dashboard/applications", title: "My applications", description: applicationCount === null ? "Application totals are temporarily unavailable. Open the list to check their status." : `${applicationCount} application${applicationCount === 1 ? "" : "s"} · Follow each application’s status.` },
        { href: "/dashboard/profile", title: "My profile", description: "Keep your professional introduction and skills up to date." },
      ];

  return <PortalShell role={role} activePath="/dashboard">
    <div className="eyebrow">Your workspace</div>
    <h1>Welcome, {displayName}</h1>
    <p style={{ color: "var(--muted)", fontSize: 13 }}>{role === "employer" ? profile?.company_name || "Manage hiring from one place." : "Your next opportunity starts with one small step."}</p>
    <div className="portal-card-grid">{cards.map((card) => <Link key={card.href} className="portal-action-card" href={card.href}><strong>{card.title} <span aria-hidden="true">→</span></strong><span>{card.description}</span></Link>)}</div>
  </PortalShell>;
}
