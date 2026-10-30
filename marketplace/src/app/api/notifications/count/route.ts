import {NextResponse} from 'next/server';
import {createClient} from '@/lib/supabase/server';
export const dynamic='force-dynamic';
export async function GET(){const headers={'Cache-Control':'private, no-store, max-age=0'};const db=await createClient();if(!db)return NextResponse.json({error:'Unavailable'},{status:503,headers});const {data:{user}}=await db.auth.getUser();if(!user)return NextResponse.json({error:'Sign in required'},{status:401,headers});const {count,error}=await db.from('notifications').select('id',{count:'exact',head:true}).eq('recipient_id',user.id).is('read_at',null);return NextResponse.json(error?{error:'Unavailable'}:{count:count||0},{status:error?503:200,headers});}
