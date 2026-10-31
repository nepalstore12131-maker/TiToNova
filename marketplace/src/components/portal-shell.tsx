import experience from '@/components/member-experience.module.css';
import {SectionSeen} from '@/components/section-seen';
import {notificationSections,type NotificationSection} from '@/lib/notification-sections';
import {NotificationSync} from '@/components/notification-sync';
import { AdminNavigation } from "@/components/admin-navigation";
import { MemberNavigation } from "@/components/member-navigation";
import { createClient } from "@/lib/supabase/server";
import { ProfileAvatar } from "@/components/profile-avatar";
import { BrandMark } from "@/components/brand-mark";
import { UiIcon } from "@/components/workspace-ui";
import { NotificationBell } from "@/components/notification-bell";
import type { ReactNode } from "react";
import Link from "next/link";
import { signOut } from "@/app/auth/actions";

export type AccountRole = "freelancer" | "employer" | "admin";
type Props = { role: AccountRole; activePath: string; children: ReactNode; seenReady?:boolean };

const roleLabel: Record<AccountRole, string> = {
  freelancer: "Freelancer",
  employer: "Employer",
  admin: "Administrator",
};

export async function PortalShell({ role, activePath, children, seenReady=true }: Props) {
  const openedAt=new Date().toISOString();
  const seenSection=Object.entries(notificationSections).find(([key,path])=>key!=='applications'&&key!=='work'&&activePath===path)?.[0] as NotificationSection|undefined;
  const db=await createClient();
  const user=db?(await db.auth.getUser()).data.user:null;
  const {data:restriction}=db&&user?await db.from('account_suspensions').select('ends_at,reason').eq('account_id',user.id).is('revoked_at',null).gt('ends_at',new Date().toISOString()).order('ends_at',{ascending:false}).limit(1).maybeSingle():{data:null};
  return <div className={`page-shell premium-workspace workspace-${role} ${role!=="admin"?experience.workspace:""}`}>
    <header className="site-header">
      <Link className="brand" href="/"><BrandMark /> Titonova<span className="brand-country">WORKSPACE</span></Link>
      <nav className="nav-links" aria-label="Main navigation"><Link href="/jobs">Browse jobs</Link><Link href={role === "admin" ? "/admin" : "/dashboard"}>Workspace</Link></nav>
      <div className="nav-actions"><NotificationBell /><span className="role-badge">{roleLabel[role]}</span><form action={signOut}><button className="text-button" type="submit">Log out</button></form></div>
    </header>
    <div className="portal-layout">
      <aside className="portal-sidebar" aria-label="Workspace pages">
        <div className="ws-sidebar-profile">{user&&role!=="admin"?<ProfileAvatar id={user.id} name={roleLabel[role]}/>:<span className="ws-sidebar-avatar"><UiIcon name="shield"/></span>}<div><strong>{roleLabel[role]}</strong><small>Your Titonova workspace</small></div></div><div className="portal-sidebar-label">WORKSPACE</div>
        {role === "admin" ? <AdminNavigation activePath={activePath}/> : <MemberNavigation role={role} activePath={activePath}/>}
        {role==="admin"&&<Link className="ws-sidebar-discover" href="/jobs"><UiIcon name="spark" size={17}/><span>Explore opportunities</span><UiIcon size={14}/></Link>}
      </aside>
      <main className="dashboard portal-main"><NotificationSync stamp={openedAt}/>{role!=="admin"&&seenReady&&seenSection&&<SectionSeen section={seenSection} openedAt={openedAt}/>}{restriction&&<section className="form-alert" role="status"><strong>Marketplace access temporarily suspended</strong><p>{restriction.reason}</p><p>Until {new Date(restriction.ends_at).toLocaleString('en-NP',{timeZone:'Asia/Kathmandu'})} NPT. You can still read your records, respond to your case and contact Support.</p><Link href="/dashboard/disputes">View restriction and appeal options →</Link></section>}{children}</main>
    </div>
  </div>;
}
