import {notFound,redirect} from 'next/navigation';
import {createClient} from '@/lib/supabase/server';
import {PortalShell,type AccountRole} from '@/components/portal-shell';
export default async function Notice({params}:{params:Promise<{id:string}>}){
 const db=await createClient();if(!db)redirect('/login');const {data:{user}}=await db.auth.getUser();if(!user)redirect('/login');const {id}=await params;
 const {data:n}=await db.from('admin_notices').select('title,body,created_at').eq('id',id).maybeSingle();if(!n)notFound();const {data:p}=await db.from('profiles').select('role').eq('id',user.id).single();if(!p)redirect('/login');
 return <PortalShell role={p.role as AccountRole} activePath="/dashboard/notifications"><span className="eyebrow">Titonova notice</span><h1>{n.title}</h1><time>{new Date(n.created_at).toLocaleString('en-NP',{timeZone:'Asia/Kathmandu'})} NPT</time><section className="dashboard-card" style={{whiteSpace:'pre-wrap'}}>{n.body}</section></PortalShell>;
}
