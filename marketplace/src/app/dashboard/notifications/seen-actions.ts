'use server';
import {createClient} from '@/lib/supabase/server';
import {sectionPath,validSeenTime} from '@/lib/notification-sections';
export async function markSectionSeen(section:string,openedAt:string){
 const path=sectionPath(section);if(!path||!validSeenTime(openedAt))return {ok:false};
 const db=await createClient();if(!db)return {ok:false};const {data:{user}}=await db.auth.getUser();if(!user)return {ok:false};
 let query=db.from('notifications').update({read_at:new Date().toISOString()}).eq('recipient_id',user.id).is('read_at',null).lte('created_at',openedAt).neq('kind','message').neq('kind','announcement');
 if(section==='reviews')query=query.eq('kind','review');else query=query.neq('kind','review').or(`href.eq.${path},href.like.${path}/%,href.like.${path}?%,href.like.${path}#%`);
 const {error}=await query;return {ok:!error};
}
