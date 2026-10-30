'use server';
import {redirect} from 'next/navigation';
import {revalidatePath} from 'next/cache';
import {createClient} from '@/lib/supabase/server';
const uuid=(s:string)=>/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s);
const text=(f:FormData,k:string)=>String(f.get(k)||'').trim();
function evidenceOK(s:string){if(!s)return true;try{const u=new URL(s);return s.length<=1000&&u.protocol==='https:'&&!u.username&&!u.password;}catch{return false;}}
export async function disputeAction(f:FormData){
 const db=await createClient();if(!db)redirect('/login');const {data:{user}}=await db.auth.getUser();if(!user)redirect('/login');
 const action=text(f,'action'),id=text(f,'id'),body=text(f,'body'),evidence=text(f,'evidence');
 if(!uuid(id))redirect('/dashboard/disputes?error=invalid');
 let dest=action==='open'?'/dashboard/disputes':`/dashboard/disputes/${id}`;let result;
 if(action==='open'){
  if(body.length<20||body.length>4000||!evidenceOK(evidence)||f.get('sharing')!=='on')redirect(dest+'?error=invalid');
  result=await db.rpc('open_work_dispute',{p_assignment:id,p_reason:text(f,'reason'),p_details:body,p_evidence:evidence});
  if(!result.error&&result.data)dest=`/dashboard/disputes/${result.data}`;
 }else if(action==='reply'){
  if(body.length<5||body.length>4000||!evidenceOK(evidence)||f.get('sharing')!=='on')redirect(dest+'?error=invalid');
  result=await db.rpc('reply_work_dispute',{p_dispute:id,p_body:body,p_evidence:evidence});
 }else{
  const {data:p}=await db.from('profiles').select('role').eq('id',user.id).maybeSingle();if(p?.role!=='admin')redirect('/dashboard/disputes?error=denied');
  if(action==='review'){
   if(body.length<10||body.length>4000)redirect(dest+'?error=invalid');
   result=await db.rpc('review_work_dispute',{p_dispute:id,p_status:text(f,'status'),p_decision:body});
  }else if(action==='suspend'){
   const target=text(f,'account'),days=Number(text(f,'days'));
   if(!uuid(target)||!Number.isInteger(days)||days<1||days>90||body.length<10||body.length>2000||f.get('reviewed')!=='on')redirect(dest+'?error=invalid');
   result=await db.rpc('suspend_case_account',{p_dispute:id,p_account:target,p_days:days,p_reason:body});
  }else if(action==='restore'){
   const suspension=text(f,'suspension');if(!uuid(suspension)||body.length<10||body.length>2000)redirect(dest+'?error=invalid');
   result=await db.rpc('restore_case_account',{p_suspension:suspension,p_reason:body});
  }else redirect(dest+'?error=invalid');
 }
 if(result.error)redirect(dest+'?error=save');revalidatePath('/dashboard','layout');redirect(dest+'?success=1');
}
