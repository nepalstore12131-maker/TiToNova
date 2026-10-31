import 'server-only';
import {createClient} from '@supabase/supabase-js';
import {after} from 'next/server';
export function scheduleNotificationEmails(){after(async()=>{try{await deliverNotificationEmails();}catch{console.error('Notification email dispatch failed; queued updates retained.');}});}
export async function deliverNotificationEmails(){
 const url=process.env.NEXT_PUBLIC_SUPABASE_URL,key=process.env.SUPABASE_SERVICE_ROLE_KEY,api=process.env.RESEND_API_KEY,from=process.env.NOTIFICATION_EMAIL_FROM;
 if(process.env.NOTIFICATION_EMAIL_ENABLED!=='true'||!url||!key||!api||!from)return {configured:false,sent:0};
 const db=createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false}});
 const {data:rows,error}=await db.rpc('claim_notification_emails',{p_limit:10});if(error)throw new Error('Email queue unavailable');let sent=0;
 for(const row of rows||[]){
  const finish=async(values:Record<string,unknown>)=>{const result=await db.from('email_outbox').update(values).eq('id',row.id).eq('claim_token',row.claim_token);if(result.error)throw new Error('Email delivery status unavailable');};
  try{
   const [{data:p,error:pe},{data:n,error:ne},auth]=await Promise.all([db.from('notification_preferences').select('email_kinds,job_alerts').eq('user_id',row.recipient_id).maybeSingle(),db.from('notifications').select('title,href').eq('id',row.notification_id).maybeSingle(),db.auth.admin.getUserById(row.recipient_id)]);
   if(pe||ne||auth.error)throw new Error('Recipient temporarily unavailable');
   if(!p?.email_kinds?.includes(row.kind)||!n||!auth.data.user?.email_confirmed_at||!auth.data.user.email||(row.kind==='job_alert'&&!p.job_alerts)){await finish({status:'skipped',last_error:null});continue;}
   if(row.kind==='job_alert'){
    const {data:job,error:je}=await db.from('jobs').select('status,archived_at,applications_close_at').eq('id',n.href.split('/').pop()).maybeSingle();
    if(je)throw new Error('Job temporarily unavailable');
    if(!job||job.status!=='published'||job.archived_at||(job.applications_close_at&&Date.parse(job.applications_close_at)<=Date.now())){await finish({status:'skipped'});continue;}
   }
   const destination='https://www.titonova.com/dashboard/notifications';
   // Keep the first payload fixed across retries for provider idempotency.
   const payload=row.payload||{from,to:[auth.data.user.email],subject:'Titonova: '+n.title,text:n.title+'\n\nOpen Titonova and sign in to view this update:\n'+destination+'\n\nManage or turn off these emails:\nhttps://www.titonova.com/dashboard/email-settings'};
   if(row.payload&&row.payload.to?.[0]!==auth.data.user.email){await finish({status:'skipped',last_error:'Verified email changed'});continue;}
   if(!row.payload)await finish({payload});
   const response=await fetch('https://api.resend.com/emails',{method:'POST',headers:{Authorization:`Bearer ${api}`,'Content-Type':'application/json','Idempotency-Key':`titonova-notification-${row.id}`},body:JSON.stringify(payload),signal:AbortSignal.timeout(12000)});
   if(response.ok){const result=await response.json();await finish({status:'sent',provider_id:result.id,sent_at:new Date().toISOString(),last_error:null,payload:null});sent++;}
   else {const retry=response.status===429||response.status>=500;await finish({status:retry&&row.attempts<5?'pending':'failed',available_at:new Date(Date.now()+Math.min(row.attempts*300000,3600000)).toISOString(),last_error:`Email provider HTTP ${response.status}`});}
  }catch{await finish({status:row.attempts<5?'pending':'failed',available_at:new Date(Date.now()+600000).toISOString(),last_error:'Temporary delivery error; retry queued'});}
 }
 return {configured:true,sent};
}
