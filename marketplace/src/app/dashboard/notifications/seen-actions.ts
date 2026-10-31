'use server';
import {createClient} from '@/lib/supabase/server';
import {sectionPath,validSeenTime} from '@/lib/notification-sections';
export async function markSectionSeen(section:string,openedAt:string){
 const path=sectionPath(section);if(!path||!validSeenTime(openedAt))return {ok:false};
 const db=await createClient();if(!db)return {ok:false};
 const {data:{user}}=await db.auth.getUser();if(!user)return {ok:false};
 const {error}=await db.from('notifications').update({read_at:new Date().toISOString()}).eq('recipient_id',user.id).is('read_at',null).lte('created_at',openedAt).neq('kind','message').like('href',`${path}%`);
 return {ok:!error};
}
