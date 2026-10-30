'use server';
import {redirect} from 'next/navigation';
import {createClient} from '@/lib/supabase/server';
const mime:Record<string,string>={'image/jpeg':'jpg','image/png':'png','image/webp':'webp','application/pdf':'pdf'};
export async function requestPromotion(form:FormData){
 const db=await createClient();if(!db)redirect('/login');const {data:{user}}=await db.auth.getUser();if(!user)redirect('/login');
 const proof=form.get('proof'),job=String(form.get('job_id')||''),plan=String(form.get('plan_id')||''),days=Number(form.get('days')),price=Number(form.get('daily_price')),method=String(form.get('method')||''),transaction=String(form.get('transaction')||'').trim();
 if(!/^[0-9a-f-]{36}$/i.test(job)||!/^[0-9a-f-]{36}$/i.test(plan)||!Number.isInteger(days)||days<1||days>90||!Number.isInteger(price)||price<1||!['esewa','khalti','bank'].includes(method)||transaction.length<4||transaction.length>120||!(proof instanceof File)||!mime[proof.type]||proof.size<1||proof.size>5242880)redirect('/dashboard/promotions?error=invalid');
 const path=`${user.id}/${crypto.randomUUID()}.${mime[proof.type]}`;const upload=await db.storage.from('promotion-proofs').upload(path,proof,{contentType:proof.type,upsert:false});if(upload.error)redirect('/dashboard/promotions?error=upload');
 const {error}=await db.rpc('request_job_promotion',{p_job:job,p_plan:plan,p_days:days,p_daily_price:price,p_method:method,p_transaction:transaction,p_proof:path});
 if(error){await db.storage.from('promotion-proofs').remove([path]);redirect('/dashboard/promotions?error=save');}redirect('/dashboard/promotions?success=submitted');
}
