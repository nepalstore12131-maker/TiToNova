import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { BrandMark } from './brand-mark';
import { UiIcon } from './workspace-ui';
export async function MarketplaceHeader({jobs=false,ne=false}:{jobs?:boolean;ne?:boolean}){
 const db = await createClient();
 const user = db ? (await db.auth.getUser()).data.user : null;
 const workspaceLabel = ne ? "कार्यस्थल" : "My workspace";
 return <header className="site-header public-header market-header"><Link className="brand" href={ne?'/ne':'/'}><BrandMark/>Titonova<span className="brand-country">NEPAL</span></Link><nav className="nav-links" aria-label="Main navigation"><Link href="/jobs" aria-current={jobs?'page':undefined}>{ne?'अवसर खोज्नुहोस्':'Find work'}</Link><Link href="/#employers">{ne?'रोजगारदाताका लागि':'Hire someone'}</Link><Link href="/dashboard">{ne?'कार्यस्थल':'Your workspace'}</Link></nav><div className="nav-actions">{!user&&<Link className="text-button public-login" href="/login">{ne?'लग इन':'Log in'}</Link>}<Link className="button" href={jobs?'/dashboard/jobs/new':user?'/dashboard':'/signup'}>{jobs?(ne?'रोजगारी पोस्ट':'Post a job'):user?workspaceLabel:'Get started'}<UiIcon size={16}/></Link><details className="public-mobile-menu"><summary aria-label="Open navigation"><UiIcon name="grid"/></summary><nav aria-label="Mobile navigation"><Link href="/jobs">Find work</Link><Link href="/signup?role=employer">Hire someone</Link><Link href="/dashboard">Your workspace</Link>{!user&&<Link href="/login">Log in</Link>}<Link href="/ne">नेपाली</Link></nav></details></div></header>;
}
