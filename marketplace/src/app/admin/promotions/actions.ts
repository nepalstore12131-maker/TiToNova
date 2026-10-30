'use server';
import {redirect} from 'next/navigation';
import {requireAdminContext} from '@/lib/supabase/admin';
export async function savePromotionPlan(form:FormData){
 const {sessionClient:db}=await requireAdminContext();const id=String(form.get('id')||'');const name=String(form.get('name')||'').trim();const price=Number(form.get('price')),priority=Number(form.get('priority')),days=Number(form.get('max_days'));if(name.length<2||name.length>80||!Number.isInteger(price)||price<0||price>1000000||!Number.isInteger(priority)||priority<1||priority>100||!Number.isInteger(days)||days<1||days>90)redirect('/admin/promotions?error=invalid');
 const row={name,daily_price_npr:price,priority,max_days:days,active:form.get('active')==='on'};const result=id?await db.from('promotion_plans').update(row).eq('id',id):await db.from('promotion_plans').insert(row);if(result.error)redirect('/admin/promotions?error=save');redirect('/admin/promotions?success=saved');
}
export async function reviewPromotion(form:FormData){
 const {sessionClient:db}=await requireAdminContext();const id=String(form.get('request_id')||''),decision=String(form.get('decision')||''),note=String(form.get('note')||'').trim();if(!['approve','reject'].includes(decision)||note.length>1000||(decision==='approve'&&form.get('verified')!=='on'))redirect('/admin/promotions?error=verify');const {error}=await db.rpc('review_job_promotion',{p_request:id,p_approve:decision==='approve',p_note:note});if(error)redirect('/admin/promotions?error=review');redirect('/admin/promotions?success=reviewed');
}
export async function stopPromotion(form:FormData){const {sessionClient:db}=await requireAdminContext();const {error}=await db.rpc('stop_job_promotion',{p_job:String(form.get('job_id')||'')});redirect(`/admin/promotions?${error?'error=save':'success=stopped'}`);}
