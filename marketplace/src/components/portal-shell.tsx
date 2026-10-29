import type { ReactNode } from "react";
import Link from "next/link";
import { signOut } from "@/app/auth/actions";

export type AccountRole = "freelancer" | "employer" | "admin";
type Props = { role: AccountRole; activePath: string; children: ReactNode };

const navigation: Record<AccountRole, { href: string; label: string }[]> = {
  freelancer: [
    { href: "/dashboard", label: "Overview" },
    { href: "/dashboard/applications", label: "My applications" },
    { href: "/dashboard/profile", label: "My profile" },
  ],
  employer: [
    { href: "/dashboard", label: "Overview" },
    { href: "/dashboard/jobs", label: "My job posts" },
    { href: "/dashboard/jobs/new", label: "Post a job" },
    { href: "/dashboard/applications", label: "Applications received" },
    { href: "/dashboard/profile", label: "Company profile" },
  ],
  admin: [
    { href: "/admin", label: "Overview" },
    { href: "/admin/jobs", label: "Review jobs" },
    { href: "/admin/listings", label: "All job posts" },
    { href: "/admin/employers", label: "Employer review" },
    { href: "/admin/reports", label: "Job reports" },
    { href: "/admin/applications", label: "Applications" },
    { href: "/admin/users", label: "Accounts" },
  ],
};

const roleLabel: Record<AccountRole, string> = {
  freelancer: "Freelancer",
  employer: "Employer",
  admin: "Administrator",
};

export function PortalShell({ role, activePath, children }: Props) {
  return <div className="page-shell">
    <header className="site-header">
      <Link className="brand" href="/"><span className="brand-mark">↗</span> Titonova</Link>
      <nav className="nav-links" aria-label="Main navigation"><Link href="/jobs">Browse jobs</Link><Link href={role === "admin" ? "/admin" : "/dashboard"}>Workspace</Link></nav>
      <div className="nav-actions"><span className="role-badge">{roleLabel[role]}</span><form action={signOut}><button className="text-button" type="submit">Log out</button></form></div>
    </header>
    <div className="portal-layout">
      <aside className="portal-sidebar" aria-label="Workspace pages">
        <div className="portal-sidebar-label">{roleLabel[role]} workspace</div>
        <nav className="portal-nav">
          {navigation[role].map((item) => <Link key={item.href} className={activePath === item.href ? "portal-nav-link active" : "portal-nav-link"} href={item.href} aria-current={activePath === item.href ? "page" : undefined}>{item.label}</Link>)}
        </nav>
      </aside>
      <main className="dashboard portal-main">{children}</main>
    </div>
  </div>;
}
