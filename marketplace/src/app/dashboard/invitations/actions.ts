'use server';
import {redirect} from 'next/navigation';
import {revalidatePath} from 'next/cache';
import {createClient} from '@/lib/supabase/server';
const valid=(s:string)=>/^[0-9a-f-]{36}$/i.test(s);
export async function repeatHiring(f:FormData){
 const db=await createClient();if(!db)redirect('/login');const {data:{user}}=await db.auth.getUser();if(!user)redirect('/login');const action=String(f.get('action')||''),worker=String(f.get('worker')||''),id=String(f.get('id')||'');let result;let dest='/dashboard/invitations';
 if(action==='save'||action==='remove'){dest='/dashboard/saved-workers';if(!valid(worker))redirect(dest+'?error=1');result=await db.rpc('save_previous_worker',{p_worker:worker,p_save:action==='save'});}
 else if(action==='invite'){const note=String(f.get('note')||'').trim();if(!valid(worker)||!valid(id)||note.length<10||note.length>2000)redirect(dest+'?error=1');result=await db.rpc('invite_previous_worker',{p_worker:worker,p_job:id,p_note:note});}
 else if(['accept','decline','cancel'].includes(action)){if(!valid(id)||(action==='accept'&&f.get('consent')!=='on'))redirect(dest+'?error=1');result=await db.rpc('respond_rehire_invitation',{p_invitation:id,p_action:action});}else redirect(dest+'?error=1');
 if(result.error)redirect(dest+'?error=1');revalidatePath('/dashboard','layout');redirect(dest+'?success=1');
}
