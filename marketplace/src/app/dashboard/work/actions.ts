'use server';
import {redirect} from 'next/navigation';
import {revalidatePath} from 'next/cache';
import {createClient} from '@/lib/supabase/server';
const valid=(v:string)=>/^[0-9a-f-]{36}$/i.test(v);
async function client(){const db=await createClient();if(!db)redirect('/login');const {data:{user}}=await db.auth.getUser();if(!user)redirect('/login');return db;}
export async function assignWorker(form:FormData){
 const id=String(form.get('application_id')||'');if(!valid(id))redirect('/dashboard/applications');
 const db=await client();const {error}=await db.rpc('assign_job_worker',{p_application:id});
 if(error)redirect(`/dashboard/applications/${id}?error=assignment`);
 revalidatePath('/','layout');redirect('/dashboard/work?success=assigned');
}
export async function updateWork(form:FormData){
 const id=String(form.get('assignment_id')||''),action=String(form.get('work_action')||''),progress=Number(form.get('progress')||0),note=String(form.get('note')||'').trim();
 if(!valid(id)||!['start','progress','submit','complete','revise','cancel'].includes(action)||!Number.isInteger(progress)||progress<0||progress>100||note.length>2000)redirect('/dashboard/work?error=invalid');
 const db=await client();const {error}=await db.rpc('update_job_work',{p_assignment:id,p_action:action,p_progress:progress,p_note:note});
 if(error)redirect('/dashboard/work?error=update');
 revalidatePath('/','layout');redirect(action==='complete'?`/dashboard/work?view=history#work-${id}`:'/dashboard/work?success=updated');
}
export async function archiveListing(form:FormData){
 const id=String(form.get('job_id')||'');if(!valid(id))redirect('/dashboard/jobs?error=invalid');
 const db=await client();const restore=form.get('restore')==='yes';
 const {error}=await db.rpc('archive_job_listing',{p_job:id,p_restore:restore});
 if(error)redirect('/dashboard/jobs?error=archive');
 revalidatePath('/','layout');redirect(`/dashboard/jobs?success=${restore?'restored':'archived'}`);
}

export async function reopenPositions(form:FormData){const id=String(form.get('job_id')||'');if(!valid(id))redirect('/dashboard/jobs?error=invalid');const db=await client();const {error}=await db.rpc('request_reopen_positions',{p_job:id});if(error)redirect('/dashboard/jobs?error=reopen');revalidatePath('/','layout');redirect('/dashboard/jobs?success=reopen');}
