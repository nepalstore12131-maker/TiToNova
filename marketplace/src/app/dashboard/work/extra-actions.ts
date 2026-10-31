"use server";
import {redirect} from 'next/navigation';
import {revalidatePath} from 'next/cache';
import {createClient} from '@/lib/supabase/server';
import {nepalDateToIso} from '@/lib/interview-time';
import {parseSamples} from '@/lib/work-samples';
export async function extraWorkAction(f:FormData){
 const id=String(f.get('assignment_id')||''),action=String(f.get('action')||'');if(!/^[0-9a-f-]{36}$/i.test(id))redirect('/dashboard/work');const dest='/dashboard/work/'+id;const view=action==='delivery'?'delivery':'schedule';
 const db=await createClient();if(!db)redirect('/login');const {data:{user}}=await db.auth.getUser();if(!user)redirect('/login');let result;
 if(action==='delivery'){const links=parseSamples(String(f.get('links')||''));if(!links)redirect(dest+'?tab='+view+'&extra=error');result=await db.rpc('submit_work_delivery',{p_assignment:id,p_summary:String(f.get('summary')||'').trim(),p_links:links});}
 else if(action==='request'){
  const st=String(f.get('start')||''),dt=String(f.get('due')||''),start=st?nepalDateToIso(st):null,due=dt?nepalDateToIso(dt):null;
  if((st&&!start)||(dt&&!due))redirect(dest+'?tab='+view+'&extra=error');result=await db.rpc('request_work_change',{p_assignment:id,p_kind:String(f.get('kind')),p_reason:String(f.get('reason')||'').trim(),p_start:start,p_due:due});
 }else if(['approve','reject','withdraw'].includes(action)){
  const request=String(f.get('request_id')||'');const {data:c}=await db.from('work_change_requests').select('id').eq('id',request).eq('assignment_id',id).maybeSingle();if(!c)redirect(dest+'?tab='+view+'&extra=error');result=await db.rpc('review_work_change',{p_request:request,p_action:action,p_note:String(f.get('note')||'').trim()});
 }else redirect(dest+'?tab='+view+'&extra=error');
 if(result.error)redirect(dest+'?tab='+view+'&extra=error');revalidatePath('/','layout');redirect(dest+'?tab='+view+'&extra=saved');
}
