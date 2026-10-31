'use server';
import {redirect} from 'next/navigation';
import {revalidatePath} from 'next/cache';
import {createClient} from '@/lib/supabase/server';
const valid=(s:string)=>/^[0-9a-f-]{36}$/i.test(s);
export async function changeAgreement(form:FormData){
 const id=String(form.get('assignment_id')||'');if(!valid(id))redirect('/dashboard/work');const inline=form.get("return_to")==="work";const dest=inline?"/dashboard/work":`/dashboard/work/${id}`;const resultUrl=(status:string)=>inline?`${dest}?agreement=${status}&assignment=${id}#work-${id}`:`${dest}?agreement=${status}`;
 const db=await createClient();if(!db)redirect('/login');const {data:{user}}=await db.auth.getUser();if(!user)redirect('/login');
 const action=String(form.get('agreement_action')||'');let result;
 if(action==='propose'){
  const scope=String(form.get('scope')||'').trim(),amountText=String(form.get('amount')||''),amount=Number(amountText),basis=String(form.get('pay_basis')||''),method=String(form.get('payment_method')||''),terms=String(form.get('payment_terms')||'').trim(),time=String(form.get('time_arrangement')||'').trim(),previous=String(form.get('previous')||'');
  if(form.get('proposal_consent')!=='on'||scope.length<20||scope.length>6000||!/^\d+(\.\d{1,2})?$/.test(amountText)||!Number.isFinite(amount)||amount<=0||amount>1000000000||!['project','hour','day','month'].includes(basis)||!['cash','bank','esewa','khalti','other'].includes(method)||terms.length<5||terms.length>2000||time.length<3||time.length>1000||(previous&&!valid(previous)))redirect(resultUrl('invalid'));
  result=await db.rpc('propose_work_agreement',{p_assignment:id,p_previous:previous||null,p_scope:scope,p_amount:amount,p_basis:basis,p_method:method,p_payment_terms:terms,p_time_arrangement:time});
 }else if(action==='accept'||action==='changes'){
  const agreement=String(form.get('agreement_id')||''),note=String(form.get('change_note')||'').trim();if(!valid(agreement)||note.length>2000||(action==='accept'&&form.get('accept_consent')!=='on')||(action==='changes'&&note.length<5))redirect(resultUrl('invalid'));
  const {data:record}=await db.from('work_agreements').select('id').eq('id',agreement).eq('assignment_id',id).maybeSingle();if(!record)redirect(resultUrl('error'));
  result=await db.rpc('respond_work_agreement',{p_agreement:agreement,p_accept:action==='accept',p_note:note});
 }else redirect(resultUrl('invalid'));
 if(result.error)redirect(resultUrl('error'));revalidatePath('/dashboard/work');revalidatePath(`/dashboard/work/${id}`);redirect(action==='accept'?`/dashboard/work?agreement=saved&assignment=${id}#work-${id}`:resultUrl('saved'));
}
