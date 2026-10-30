import Link from 'next/link';
import {redirect} from 'next/navigation';
import {createClient} from '@/lib/supabase/server';
import {PortalShell} from '@/components/portal-shell';
export const dynamic='force-dynamic';
export default async function EarningsPage(){
 const db=await createClient();if(!db)return <main className="dashboard"><p>Earnings are temporarily unavailable.</p></main>;
 const {data:{user}}=await db.auth.getUser();if(!user)redirect('/login?next=%2Fdashboard%2Fearnings');
 const {data:profile}=await db.from('profiles').select('role').eq('id',user.id).maybeSingle();
 if(!profile)return <main className="dashboard"><p>Your account could not be loaded. Please refresh.</p></main>;
 if(profile.role==='admin')redirect('/admin/payments');
 if(profile.role==='employer')redirect('/dashboard/billing');
 const {data:hires,count,error}=await db.from('applications').select('id,job:jobs(title)',{count:'exact'}).eq('applicant_id',user.id).eq('hiring_stage','hired').neq('status','withdrawn').order('created_at',{ascending:false}).limit(5);
 return <PortalShell role="freelancer" activePath="/dashboard/earnings">
 <div className="eyebrow">Your work, your progress</div><h1>Earnings</h1><p className="money-disclosure">A clear view of what Titonova currently records for your account.</p>
 <div className="money-metrics"><section className="dashboard-card"><span className="eyebrow">Work payments</span><h2>Not tracked yet</h2><p>Titonova does not currently record wages or project payments.</p></section><section className="dashboard-card"><span className="eyebrow">Withdrawals</span><h2>Not available</h2><p>No wallet balance or payout service is active.</p></section><section className="dashboard-card"><span className="eyebrow">Marked as hired</span><h2>{error?'—':count??0}</h2><p>A hiring stage is not proof of payment or completed work.</p></section></div>
 <section className="dashboard-card money-panel"><div className="eyebrow">Payment history</div><h2>No work-payment ledger yet</h2><p>Payments arranged directly with an employer are not visible here. This page cannot confirm whether you have been paid.</p><p>Before starting work, agree on the amount in NPR, what you will deliver, payment dates, and the payment method. Keep the agreement and transaction reference in your application conversation.</p><Link className="button secondary" href="/dashboard/applications">Open applications and conversations →</Link></section>
 <section className="dashboard-card money-panel"><div className="eyebrow">Related work</div><h2>Recent hiring activity</h2>{error?<p role="alert">Hiring activity could not be loaded. Please refresh.</p>:!hires?.length?<p>No applications have been marked as hired yet. Your application progress is available in My applications.</p>:<ul className="money-work-list">{hires.map(a=>{const job=Array.isArray(a.job)?a.job[0]:a.job;return <li key={a.id}><Link href={`/dashboard/applications/${a.id}`}>{job?.title||'Job application'} ↗</Link><span className="status-tag">Hired</span></li>;})}</ul>}<Link href="/dashboard/applications">View all applications →</Link></section>
 </PortalShell>;
}
