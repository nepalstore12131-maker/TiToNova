import {redirect} from 'next/navigation';
import Link from 'next/link';
import {createClient} from '@/lib/supabase/server';
import {PortalShell,type AccountRole} from '@/components/portal-shell';
import {Reputation} from '@/components/reputation';
export const dynamic='force-dynamic';
export default async function Reviews(){const db=await createClient();if(!db)redirect('/login');const {data:{user}}=await db.auth.getUser();if(!user)redirect('/login');const {data:p}=await db.from('profiles').select('role').eq('id',user.id).maybeSingle();if(!p)redirect('/dashboard');return <PortalShell role={p.role as AccountRole} activePath="/dashboard/reviews"><h1>My reputation</h1><p>Ratings come from people you completed work with. You can leave feedback from <Link href="/dashboard/work?view=history">completed work history</Link>.</p><Reputation id={user.id}/></PortalShell>;}
