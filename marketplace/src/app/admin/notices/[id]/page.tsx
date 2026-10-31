import {notFound} from 'next/navigation';
import {requireAdminContext} from '@/lib/supabase/admin';
import {PortalShell} from '@/components/portal-shell';
export default async function NoticeHistory({params,searchParams}:{params:Promise<{id:string}>,searchParams:Promise<Record<string,string|undefined>>}){
 const {sessionClient:db}=await requireAdminContext();const {id}=await params;const p=await searchParams;const page=Math.max(1,Math.min(10000,parseInt(p.page||'1')||1));
 const {data:n}=await db.from('admin_notices').select('*').eq('id',id).maybeSingle();if(!n)notFound();
 const {data:rows,error}=await db.from('notice_recipients').select('user_id,profile:profiles!notice_recipients_user_id_fkey(full_name,role)').eq('notice_id',id).order('user_id').range((page-1)*50,page*50);
 return <PortalShell role="admin" activePath="/admin/notices"><h1>{n.title}</h1><p style={{whiteSpace:'pre-wrap'}}>{n.body}</p><p>{n.recipient_count} accounts at send time</p><h2>Recipient history</h2>{error?<p className="form-alert">Recipients could not be loaded.</p>:<ul>{rows?.slice(0,50).map(r=>{const profile=(Array.isArray(r.profile)?r.profile[0]:r.profile) as {full_name:string;role:string}|null;return <li key={r.user_id}>{profile?.full_name||'Account'} · {profile?.role==='freelancer'?'Worker':profile?.role}</li>})}</ul>}<nav className="admin-pagination">{page>1&&<a href={'?page='+(page-1)}>Previous</a>}<span>Page {page}</span>{(rows?.length||0)>50&&<a href={'?page='+(page+1)}>Next</a>}</nav></PortalShell>;
}
