"use server";
import {safeNotificationHref} from '@/lib/email-kinds';
import {redirect} from 'next/navigation';
import {revalidatePath} from 'next/cache';
import {createClient} from '@/lib/supabase/server';
export async function markNotificationsRead(form:FormData){
 const db=await createClient();if(!db)redirect('/login');const {data:{user}}=await db.auth.getUser();if(!user)redirect('/login');
 const id=String(form.get('notification_id')||'');if(id&&!/^[0-9a-f-]{36}$/i.test(id))redirect('/dashboard/notifications?error=invalid');
 let query=db.from('notifications').update({read_at:new Date().toISOString()}).eq('recipient_id',user.id).is('read_at',null);if(id)query=query.eq('id',id);
 const {error}=await query;if(error)redirect('/dashboard/notifications?error=save');revalidatePath('/dashboard/notifications');redirect('/dashboard/notifications?success=read');
}

export async function openNotification(form:FormData){
 const db=await createClient();if(!db)redirect('/login');const {data:{user}}=await db.auth.getUser();if(!user)redirect('/login');
 const id=String(form.get('notification_id')||'');if(!/^[0-9a-f-]{36}$/i.test(id))redirect('/dashboard/notifications?error=invalid');
 const {data:n,error}=await db.from('notifications').select('href').eq('id',id).eq('recipient_id',user.id).maybeSingle();if(error||!n)redirect('/dashboard/notifications?error=invalid');
 const {error:saveError}=await db.from('notifications').update({read_at:new Date().toISOString()}).eq('id',id).eq('recipient_id',user.id).is('read_at',null);if(saveError)redirect('/dashboard/notifications?error=save');
 revalidatePath('/dashboard/notifications');redirect(safeNotificationHref(n.href));
}
