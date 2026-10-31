"use server";
import {offerErrorCode} from '@/lib/service-offer-errors';
import {redirect} from 'next/navigation';
import {revalidatePath} from 'next/cache';
import {createClient} from '@/lib/supabase/server';
import {nepalDateToIso} from '@/lib/interview-time';
export async function serviceOfferAction(f:FormData){
 const id=String(f.get('request_id')||'');if(!/^[0-9a-f-]{36}$/i.test(id))redirect('/dashboard/service-requests');const dest='/dashboard/service-requests/'+id;
 const db=await createClient();if(!db)redirect('/login');const {data:{user}}=await db.auth.getUser();if(!user)redirect('/login');
 const action=String(f.get('action')||'');let result;
 if(action==='propose'){
  const startText=String(f.get('start')||''),dueText=String(f.get('due')||''),start=startText?nepalDateToIso(startText):null,due=dueText?nepalDateToIso(dueText):null;
  if(f.get('consent')!=='on')redirect(dest+'?offer=consent');
  if((startText&&!start)||(dueText&&!due)||(due&&(!start||due<=start))||(start&&Date.parse(start)<=Date.now()))redirect(dest+'?offer=dates');
  const title=String(f.get('title')||'').trim(),scope=String(f.get('scope')||'').trim(),terms=String(f.get('terms')||'').trim(),time=String(f.get('time')||'').trim(),amount=Number(f.get('amount'));
  if(title.length<4||title.length>120||scope.length<30||scope.length>6000||terms.length<5||terms.length>2000||time.length<3||time.length>1000||!Number.isInteger(amount)||amount<1||amount>100000000)redirect(dest+'?offer=fields');
  result=await db.rpc('propose_service_work',{p_request:id,p_previous:String(f.get('previous')||'')||null,p_title:String(f.get('title')||'').trim(),p_scope:String(f.get('scope')||'').trim(),p_amount:Number(f.get('amount')),p_basis:String(f.get('basis')),p_method:String(f.get('method')),p_terms:String(f.get('terms')||'').trim(),p_time:String(f.get('time')||'').trim(),p_start:start,p_due:due});
 }else if(['accept','decline','withdraw'].includes(action)){
  const offer=String(f.get('offer_id')||'');if(!/^[0-9a-f-]{36}$/i.test(offer)||(action==='accept'&&f.get('consent')!=='on'))redirect(dest+'?offer=error');
  const {data:owned}=await db.from('service_work_offers').select('id').eq('id',offer).eq('request_id',id).maybeSingle();if(!owned)redirect(dest+'?offer=error');
  result=await db.rpc('respond_service_work',{p_offer:offer,p_action:action});
 }else redirect(dest+'?offer=error');
 if(result.error)redirect(dest+'?offer='+offerErrorCode(result.error.message));revalidatePath('/','layout');redirect(dest+'?offer=saved');
}
