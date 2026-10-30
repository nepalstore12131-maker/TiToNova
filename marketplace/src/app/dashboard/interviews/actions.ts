"use server";
import {redirect} from 'next/navigation';
import {revalidatePath} from 'next/cache';
import {createClient} from '@/lib/supabase/server';
import {nepalDateToIso} from '@/lib/interview-time';
const uuid=/^[0-9a-f-]{36}$/i;
export async function proposeInterview(form:FormData){
 const id=String(form.get('application_id')||'');if(!uuid.test(id))redirect('/dashboard/interviews?error=invalid');
 const time=nepalDateToIso(String(form.get('starts_at')||'')),duration=Number(form.get('duration')),url=String(form.get('meeting_url')||'').trim(),location=String(form.get('location')||'').trim(),instructions=String(form.get('instructions')||'').trim();
 let validUrl=!url;try{if(url){const parsed=new URL(url);validUrl=parsed.protocol==='https:'&&!!parsed.hostname&&!parsed.username&&!parsed.password;}}catch{}
 if(!time||(time&&(new Date(time).getTime()<=Date.now()||new Date(time).getTime()>Date.now()+180*86400000))||!Number.isInteger(duration)||duration<15||duration>240||!validUrl||(!url&&!location)||url.length>500||location.length>250||instructions.length>1500)redirect(`/dashboard/applications/${id}?interview=invalid#interviews`);
 const db=await createClient();if(!db)redirect('/login');const {error}=await db.rpc('propose_interview',{p_application:id,p_starts_at:time,p_duration:duration,p_url:url,p_location:location,p_instructions:instructions});
 revalidatePath('/dashboard/interviews');revalidatePath(`/dashboard/applications/${id}`);
 redirect(error?`/dashboard/applications/${id}?interview=${error.message.includes('overlaps')?'conflict':'error'}#interviews`:'/dashboard/interviews?success=proposed');
}
export async function respondInterview(form:FormData){
 const id=String(form.get('interview_id')||''),response=String(form.get('response')||''),note=String(form.get('response_note')||'').trim();if(!uuid.test(id)||!['accepted','declined','reschedule_requested','cancelled'].includes(response)||note.length>1000)redirect('/dashboard/interviews?error=invalid');
 const db=await createClient();if(!db)redirect('/login');const {error}=await db.rpc('respond_interview',{p_id:id,p_response:response,p_note:note});revalidatePath('/dashboard/interviews');redirect(`/dashboard/interviews?${error?'error=changed':'success=updated'}`);
}
