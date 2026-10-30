"use server";
import {redirect} from 'next/navigation';
import {revalidatePath} from 'next/cache';
import {createClient} from '@/lib/supabase/server';
import {parseSamples} from '@/lib/work-samples';
const uuid=(v:string)=>/^[0-9a-f-]{36}$/i.test(v);
export async function serviceAction(f:FormData){
 const db=await createClient();if(!db)redirect('/login');const {data:{user}}=await db.auth.getUser();if(!user)redirect('/login');const action=String(f.get('action')||''),id=String(f.get('id')||'');let dest='/dashboard/services',result;
 if(action==='save'||action==='pause'){const samples=parseSamples(String(f.get('samples')||''));if(!samples||(id&&!uuid(id)))redirect(dest+'?error=1');result=await db.rpc('save_worker_service',{p_id:id||null,p_name:String(f.get('display_name')||'').trim(),p_title:String(f.get('title')||'').trim(),p_description:String(f.get('description')||'').trim(),p_category:String(f.get('category')||''),p_location:String(f.get('location')||'').trim(),p_price:Number(f.get('price')||0),p_unit:String(f.get('unit')||'project'),p_samples:samples.join('\n'),p_pause:action==='pause'});}
 else if(action==='request'){dest='/services/'+id;if(!uuid(id))redirect('/services');result=await db.rpc('request_worker_service',{p_service:id,p_details:String(f.get('details')||'').trim(),p_budget:f.get('budget')?Number(f.get('budget')):null});if(!result.error)redirect('/dashboard/service-requests/'+result.data);}
 else if(['reply','decline','close'].includes(action)){if(!uuid(id))redirect('/dashboard/service-requests');dest='/dashboard/service-requests/'+id;result=await db.rpc('respond_service_request',{p_id:id,p_action:action,p_body:String(f.get('body')||'').trim()});}
 else if(action==='review'){dest='/admin/services';if(!uuid(id))redirect(dest);result=await db.rpc('review_worker_service',{p_id:id,p_status:String(f.get('status')||''),p_note:String(f.get('note')||'').trim()});}else redirect('/dashboard');
 if(result?.error)redirect(dest+'?error=1');revalidatePath('/','layout');redirect(dest+'?success=1');
}
