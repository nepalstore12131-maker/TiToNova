"use server";
import {redirect} from "next/navigation";
import {createClient} from "@/lib/supabase/server";
export async function saveCareer(form:FormData){
 const db=await createClient();if(!db)redirect('/dashboard/profile?section=career&error=setup');
 const {data:{user}}=await db.auth.getUser();if(!user)redirect('/login');
 const {data:profile}=await db.from('profiles').select('role').eq('id',user.id).maybeSingle();if(profile?.role!=='freelancer')redirect('/dashboard');
 const history=String(form.get('work_history')||'').trim(),availability=String(form.get('availability')||'discuss'),period=String(form.get('pay_period')||'month');
 const raw=String(form.get('expected_pay')||'').trim(),pay=raw?Number(raw):null;
 if(history.length>6000||!['now','two_weeks','one_month','discuss'].includes(availability)||!['month','hour','project'].includes(period)||(pay!==null&&(!Number.isInteger(pay)||pay<0||pay>1000000000)))redirect('/dashboard/profile?section=career&error=invalid');
 const {data:old}=await db.from('candidate_profiles').select('resume_path').eq('id',user.id).maybeSingle();
 let path=form.get('remove_resume')==='1'?'':old?.resume_path||'';
 const file=form.get('resume');let uploaded='';
 if(file instanceof File&&file.size){
  if(file.size>5*1024*1024||file.type!=='application/pdf')redirect('/dashboard/profile?section=career&error=resume');
  const bytes=new Uint8Array(await file.arrayBuffer());if(new TextDecoder().decode(bytes.slice(0,5))!=='%PDF-')redirect('/dashboard/profile?section=career&error=resume');
  path=`${user.id}/${crypto.randomUUID()}.pdf`;
  const {error}=await db.storage.from('candidate-resumes').upload(path,bytes,{contentType:'application/pdf',upsert:false});if(error)redirect('/dashboard/profile?section=career&error=upload');uploaded=path;
 }
 const {error}=await db.from('candidate_profiles').upsert({id:user.id,work_history:history,availability,expected_pay:pay,pay_period:period,resume_path:path,updated_at:new Date().toISOString()});
 if(error){if(uploaded)await db.storage.from('candidate-resumes').remove([uploaded]);redirect('/dashboard/profile?section=career&error=save');}
 if(old?.resume_path&&old.resume_path!==path)await db.storage.from('candidate-resumes').remove([old.resume_path]);
 redirect('/dashboard/profile?section=career&success=saved');
}
