import Link from 'next/link';
import {redirect} from 'next/navigation';
import {PortalShell} from '@/components/portal-shell';
import {requireAdminContext} from '@/lib/supabase/admin';
import {saveControls} from '../actions';
export const dynamic='force-dynamic';
export default async function ConfirmRetention({searchParams}:{searchParams:Promise<Record<string,string|undefined>>}){
 const {sessionClient:db}=await requireAdminContext();const p=await searchParams;const hours=Number(p.hours);const version=Number(p.version);const enabled=p.enabled==='true';
 if(!Number.isInteger(hours)||hours<1||hours>720||!['true','false'].includes(p.enabled||''))redirect('/admin/settings?error=invalid');
 const {data:s}=await db.from('marketplace_controls').select('*').eq('id',true).single();if(!s||s.version!==version)redirect('/admin/settings?error=stale');
 const {count}=await db.from('support_tickets').select('id',{count:'exact',head:true}).eq('status','resolved').lte('resolved_at',new Date(Date.now()-hours*3600000).toISOString());
 return <PortalShell role="admin" activePath="/admin/settings"><h1>Confirm support retention</h1><section className="dashboard-card"><p>{enabled?`Resolved requests will be permanently deleted ${hours} hours after resolution, on the next scheduled cleanup.`:'Automatic deletion will be paused. Resolved requests will remain read-only in History.'}</p><p>This applies to existing and future resolved requests. {enabled?`${count??'An unknown number of'} current requests already meet this deadline.`:''} Deletion removes the conversation, messages and related notifications. Deleted history cannot be restored through Titonova. Open and in-progress requests are kept.</p><form action={saveControls} className="auth-form"><input type="hidden" name="section" value="retention"/><input type="hidden" name="version" value={version}/><input type="hidden" name="hours" value={hours}/><input type="hidden" name="enabled" value={String(enabled)}/><label htmlFor="confirmation">Type CONFIRM to apply this rule</label><input id="confirmation" name="confirmation" pattern="CONFIRM" required autoComplete="off"/><button className="button">Confirm retention change</button><Link href="/admin/settings">Cancel — keep current rule</Link></form></section></PortalShell>;
}
