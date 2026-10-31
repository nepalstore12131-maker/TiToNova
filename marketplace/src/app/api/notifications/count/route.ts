import {scheduleNotificationEmails} from '@/lib/notification-email';
import {NextResponse} from 'next/server';
import {createClient} from '@/lib/supabase/server';
export const dynamic='force-dynamic';
export async function GET(){const headers={'Cache-Control':'private, no-store, max-age=0'};const db=await createClient();if(!db)return NextResponse.json({error:'Unavailable'},{status:503,headers});const {data:{user}}=await db.auth.getUser();if(!user)return NextResponse.json({error:'Sign in required'},{status:401,headers});scheduleNotificationEmails();const {count,error}=await db.from('notifications').select('id',{count:'exact',head:true}).eq('recipient_id',user.id).is('read_at',null);if(error)return NextResponse.json({error:'Unavailable'},{status:503,headers});
 const paths=['/dashboard/applications','/dashboard/work','/dashboard/interviews','/dashboard/invitations'];
 const results=await Promise.all(paths.map(async path=>{const result=await db.from('notifications').select('id',{count:'exact',head:true}).eq('recipient_id',user.id).is('read_at',null).neq('kind','message').like('href',`${path}%`);return {path,...result};}));
 return NextResponse.json({count:count||0,sections:results.some(r=>r.error)?null:Object.fromEntries(results.map(r=>[r.path,r.count||0]))},{headers});}
