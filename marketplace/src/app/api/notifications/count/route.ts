import {scheduleNotificationEmails} from '@/lib/notification-email';
import {sectionForNotification} from '@/lib/notification-sections';
import {NextResponse} from 'next/server';
import {createClient} from '@/lib/supabase/server';
export const dynamic='force-dynamic';
export async function GET(){
 const headers={'Cache-Control':'private, no-store, max-age=0'};
 const db=await createClient();if(!db)return NextResponse.json({error:'Unavailable'},{status:503,headers});
 const {data:{user}}=await db.auth.getUser();if(!user)return NextResponse.json({error:'Sign in required'},{status:401,headers});
 scheduleNotificationEmails();
 const {data,count,error}=await db.from('notifications').select('href,kind',{count:'exact'}).eq('recipient_id',user.id).is('read_at',null).limit(1000);
 if(error)return NextResponse.json({error:'Unavailable'},{status:503,headers});
 // Never present a partial per-section count as exact for a very large inbox.
 const sections:Record<string,number>|null=(count||0)>1000?null:{};
 if(sections)for(const n of data||[]){const path=sectionForNotification(n.kind,n.href);if(path)sections[path]=(sections[path]||0)+1;}
 return NextResponse.json({count:count||0,sections},{headers});
}
