import {timingSafeEqual} from 'node:crypto';
import {deliverNotificationEmails} from '@/lib/notification-email';
export const dynamic='force-dynamic';
export const maxDuration=60;
export async function GET(request:Request){
 const secret=process.env.CRON_SECRET;const received=request.headers.get('authorization')||'';const expected=`Bearer ${secret}`;
 if(!secret||Buffer.byteLength(received)!==Buffer.byteLength(expected)||!timingSafeEqual(Buffer.from(received),Buffer.from(expected)))return Response.json({error:'Unauthorized'},{status:401});
 try{return Response.json(await deliverNotificationEmails());}catch{return Response.json({error:'Email dispatch unavailable'},{status:503});}
}
