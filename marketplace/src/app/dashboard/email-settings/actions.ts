'use server';
import {redirect} from 'next/navigation';
import {revalidatePath} from 'next/cache';
import {createClient} from '@/lib/supabase/server';
import {emailKindKeys} from '@/lib/email-kinds';
import {getJobCategories} from '@/lib/job-categories';
export async function saveEmailPreferences(f:FormData){
 const db=await createClient();if(!db)redirect('/login');const {data:{user}}=await db.auth.getUser();if(!user)redirect('/login');
 const kinds=f.getAll('email_kinds').map(String);const allowed=await getJobCategories(db);
 const categories=[...new Set(f.getAll('categories').map(String))];
 const keywords=[...new Set(String(f.get('keywords')||'').split(',').map(s=>s.trim()).filter(Boolean))];
 const location=String(f.get('location')||'').trim();const alerts=f.get('job_alerts')==='on';
 if(kinds.some(k=>!emailKindKeys.includes(k as typeof emailKindKeys[number]))||categories.some(c=>!allowed.includes(c))||categories.length>30||keywords.length>15||keywords.some(k=>k.length<2||k.length>50)||keywords.join(',').length>500||location.length>120||(alerts&&!categories.length&&!keywords.length))redirect('/dashboard/email-settings?error=invalid');
 const {error}=await db.from('notification_preferences').upsert({user_id:user.id,email_kinds:kinds,job_alerts:alerts,categories,keywords,location,updated_at:new Date().toISOString()});
 if(error)redirect('/dashboard/email-settings?error=save');revalidatePath('/dashboard/email-settings');redirect('/dashboard/email-settings?success=1');
}
