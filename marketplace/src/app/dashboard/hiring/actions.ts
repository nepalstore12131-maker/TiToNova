"use server";
import {redirect} from 'next/navigation';
import {revalidatePath} from 'next/cache';
import {createClient} from '@/lib/supabase/server';
export async function saveHiringReview(form:FormData){
 const id=String(form.get('application_id')||''),stage=String(form.get('stage')||''),notes=String(form.get('notes')||'').trim();
 if(!/^[0-9a-f-]{36}$/i.test(id)||!['new','shortlisted','interview','hired','rejected'].includes(stage)||notes.length>5000)redirect('/dashboard/hiring?error=invalid');
 const db=await createClient();if(!db)redirect('/dashboard/hiring?error=save');
 const {error}=await db.rpc('save_hiring_review',{p_application:id,p_stage:stage,p_notes:notes});
 revalidatePath('/dashboard/hiring');revalidatePath(`/dashboard/applications/${id}`);
 redirect(`/dashboard/applications/${id}?${error?'error=save':'success=updated'}`);
}
