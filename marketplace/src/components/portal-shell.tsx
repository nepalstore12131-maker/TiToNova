import { createClient } from "@/lib/supabase/server";
import { ProfileAvatar } from "@/components/profile-avatar";
import { BrandMark } from "@/components/brand-mark";
import { UiIcon } from "@/components/workspace-ui";
import { NotificationBell } from "@/components/notification-bell";
import type { ReactNode } from "react";
import Link from "next/link";
import { signOut } from "@/app/auth/actions";

export type AccountRole = "freelancer" | "employer" | "admin";
type Props = { role: AccountRole; activePath: string; children: ReactNode };

const navigation: Record<AccountRole, { href: string; label: string }[]> = {
  freelancer: [
    { href: "/dashboard", label: "Overview" },
    { href: "/dashboard/applications", label: "My applications" },
    { href: "/dashboard/interviews", label: "Interviews" },
    { href: "/dashboard/profile", label: "My profile" },
    { href: "/dashboard/settings", label: "Account settings" },
  ],
  employer: [
    { href: "/dashboard", label: "Overview" },
    { href: "/dashboard/hiring", label: "Hiring dashboard" },
    { href: "/dashboard/interviews", label: "Interviews" },
    { href: "/dashboard/jobs", label: "My job posts" },
    { href: "/dashboard/jobs/new", label: "Post a job" },
    { href: "/dashboard/billing", label: "Premium access" },
    { href: "/dashboard/applications", label: "Applications received" },
    { href: "/dashboard/profile", label: "Company profile" },
    { href: "/dashboard/settings", label: "Account settings" },
  ],
  admin: [
    { href: "/admin", label: "Overview" },
    { href: "/admin/jobs", label: "Review jobs" },
    { href: "/admin/listings", label: "All job posts" },
    { href: "/admin/employers", label: "Employer review" },
    { href: "/admin/reports", label: "Job reports" },
    { href: "/admin/messages", label: "Message moderation" },
    { href: "/admin/payments", label: "Payments and access" },
    { href: "/admin/payments/settings", label: "Premium settings" },
    { href: "/admin/applications", label: "Applications" },
    { href: "/dashboard/interviews", label: "Interviews" },
    { href: "/admin/users", label: "Accounts" },
  ],
};

const roleLabel: Record<AccountRole, string> = {
  freelancer: "Freelancer",
  employer: "Employer",
  admin: "Administrator",
};

export async function PortalShell({ role, activePath, children }: Props) {
  const db=await createClient();
  const user=db?(await db.auth.getUser()).data.user:null;
  return <div className={`page-shell premium-workspace workspace-${role}`}>
    <header className="site-header">
      <Link className="brand" href="/"><BrandMark /> Titonova<span className="brand-country">WORKSPACE</span></Link>
      <nav className="nav-links" aria-label="Main navigation"><Link href="/jobs">Browse jobs</Link><Link href={role === "admin" ? "/admin" : "/dashboard"}>Workspace</Link></nav>
      <div className="nav-actions"><NotificationBell /><span className="role-badge">{roleLabel[role]}</span><form action={signOut}><button className="text-button" type="submit">Log out</button></form></div>
    </header>
    <div className="portal-layout">
      <aside className="portal-sidebar" aria-label="Workspace pages">
        <div className="ws-sidebar-profile">{user&&role!=="admin"?<ProfileAvatar id={user.id} name={roleLabel[role]}/>:<span className="ws-sidebar-avatar"><UiIcon name="shield"/></span>}<div><strong>{roleLabel[role]}</strong><small>Your Titonova workspace</small></div></div><div className="portal-sidebar-label">WORKSPACE</div>
        <nav className="portal-nav">
          <Link className={activePath === "/dashboard/notifications" ? "portal-nav-link active" : "portal-nav-link"} href="/dashboard/notifications" aria-current={activePath === "/dashboard/notifications" ? "page" : undefined}><UiIcon name="message" size={18}/><span>Notifications</span></Link>
          {navigation[role].map((item) => <Link key={item.href} className={activePath === item.href ? "portal-nav-link active" : "portal-nav-link"} href={item.href} aria-current={activePath === item.href ? "page" : undefined}><UiIcon name={item.href.includes("interviews") ? "clock" : item.href.includes("profile") || item.href.includes("users") ? "profile" : item.href.includes("payment") || item.href.includes("billing") ? "wallet" : item.href.includes("report") || item.href.includes("moderation") ? "shield" : item.href.includes("messages") ? "message" : item.href.includes("hiring") || item.href.includes("applications") || item.href.includes("employers") ? "people" : item.href.includes("new") ? "plus" : item.href.includes("jobs") || item.href.includes("listings") ? "briefcase" : "grid"} size={18}/><span>{item.label}</span></Link>)}
        </nav>
        <Link className="ws-sidebar-discover" href="/jobs"><UiIcon name="spark" size={17}/><span>Explore opportunities</span><UiIcon size={14}/></Link>
      </aside>
      <main className="dashboard portal-main">{children}</main>
    </div>
  </div>;
}
