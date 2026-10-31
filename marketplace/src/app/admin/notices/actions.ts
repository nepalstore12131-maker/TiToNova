'use server';
import {randomUUID} from 'node:crypto';
import {redirect} from 'next/navigation';
import {revalidatePath} from 'next/cache';
import {requireAdminContext} from '@/lib/supabase/admin';
import {scheduleNotificationEmails} from '@/lib/notification-email';
export type NoticePreview={error?:string;draft?:{id:string;audience:string;title:string;body:string;count:number}};
export async function previewNotice(_previous:NoticePreview,f:FormData):Promise<NoticePreview>{
 const {sessionClient}=await requireAdminContext();const audience=String(f.get('audience')||''),title=String(f.get('title')||'').trim(),body=String(f.get('body')||'').trim();
 if(!['freelancer','employer','both'].includes(audience)||title.length<3||title.length>140||body.length<10||body.length>4000)return {error:'Choose an audience and enter a title (3–140 characters) and message (10–4,000 characters).'};
 let q=sessionClient.from('profiles').select('id',{count:'exact',head:true}).in('role',['freelancer','employer']);if(audience!=='both')q=q.eq('role',audience);
 const {count,error}=await q;if(error||count===null)return {error:'The audience could not be loaded. Try again.'};
 return {draft:{id:randomUUID(),audience,title,body,count}};
}
export async function sendNotice(f:FormData){
 const {sessionClient}=await requireAdminContext();if(f.get('confirm')!=='on')redirect('/admin/notices?error=confirm');
 const {error}=await sessionClient.rpc('send_admin_notice',{p_id:String(f.get('id')||''),p_audience:String(f.get('audience')||''),p_title:String(f.get('title')||''),p_body:String(f.get('body')||''),p_expected_count:Number(f.get('count'))});
 if(error)redirect('/admin/notices?error=send');scheduleNotificationEmails();revalidatePath('/admin/notices');redirect('/admin/notices?success=1');
}
