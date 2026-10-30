"use server";
import {redirect} from 'next/navigation';
import {revalidatePath} from 'next/cache';
import {createClient} from '@/lib/supabase/server';
const valid=(s:string)=>/^[0-9a-f-]{36}$/i.test(s);
const time=(s:string)=>/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(s)&&Number.isFinite(Date.parse(s+'+05:45'))?new Date(s+'+05:45').toISOString():null;
export async function changeSchedule(form:FormData){
 const id=String(form.get('assignment_id')||''),action=String(form.get('action')||''),note=String(form.get('note')||'').trim();
 if(!valid(id))redirect('/dashboard/work?error=invalid');const dest=`/dashboard/work/${id}`;
 const db=await createClient();if(!db)redirect('/login');const {data:{user}}=await db.auth.getUser();if(!user)redirect('/login');
 if(note.length>2000)redirect(dest+'?error=invalid');
 let result;
 if(action==='accept')result=await db.rpc('accept_work_schedule',{p_assignment:id});
 else if(action==='set'||action==='request'){
  const start=time(String(form.get('start')||'')),dueText=String(form.get('due')||''),due=dueText?time(dueText):null;if(!start||(dueText&&!due)||(due&&Date.parse(due)<=Date.parse(start)))redirect(dest+'?error=invalid');
  result=action==='set'?await db.rpc('set_work_schedule',{p_assignment:id,p_start:start,p_due:due,p_note:note}):await db.rpc('request_work_time',{p_assignment:id,p_start:start,p_due:due,p_reason:note});
 }else if(action==='approve'||action==='reject'){
  const request=String(form.get('request_id')||'');if(!valid(request))redirect(dest+'?error=invalid');
  const {data:r}=await db.from('work_time_requests').select('id').eq('id',request).eq('assignment_id',id).maybeSingle();if(!r)redirect(dest+'?error=unavailable');
  result=await db.rpc('review_work_time',{p_request:request,p_approve:action==='approve',p_note:note});
 }else redirect(dest+'?error=invalid');
 if(result.error)redirect(dest+'?error=save');revalidatePath('/dashboard/work');revalidatePath(dest);redirect(dest+'?success=saved');
}
export async function leaveWorkReview(form:FormData){
 const id=String(form.get('assignment_id')||''),rating=Number(form.get('rating')),feedback=String(form.get('feedback')||'').trim();if(!valid(id))redirect('/dashboard/work');const dest=`/dashboard/work/${id}`;
 if(form.get('public_consent')!=='on'||!Number.isInteger(rating)||rating<1||rating>5||feedback.length<5||feedback.length>2000)redirect(dest+'?error=review');const db=await createClient();if(!db)redirect('/login');const {data:{user}}=await db.auth.getUser();if(!user)redirect('/login');const {error}=await db.rpc('submit_work_review',{p_assignment:id,p_rating:rating,p_feedback:feedback});if(error)redirect(dest+'?error=review');revalidatePath(dest);redirect(dest+'?success=review');
}
