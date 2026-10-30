'use server';
import {redirect} from 'next/navigation';
import {requireAdminContext} from '@/lib/supabase/admin';
export async function saveAdPlan(form:FormData){
 const {sessionClient:db}=await requireAdminContext();const id=String(form.get('id')||''),name=String(form.get('name')||'').trim(),placement=String(form.get('placement')||''),price=Number(form.get('price')),maxDays=Number(form.get('max_days')),width=Number(form.get('width')),height=Number(form.get('height')),maxMb=Number(form.get('max_mb')),requirements=String(form.get('requirements')||'').trim(),active=form.get('active')==='on';
 if(name.length<2||name.length>80||!['home','jobs'].includes(placement)||![price,maxDays,width,height,maxMb].every(Number.isInteger)||price<0||price>1000000||maxDays<1||maxDays>90||width<600||width>2400||height<150||height>1200||width/height<2||width/height>6||maxMb<1||maxMb>2||requirements.length>2000||(active&&price<1))redirect('/admin/advertising/plans?error=invalid');
 const row={name,placement,daily_price_npr:price,max_days:maxDays,width,height,max_mb:maxMb,requirements,active};const result=id?await db.from('advertising_plans').update(row).eq('id',id):await db.from('advertising_plans').insert(row);redirect(`/admin/advertising/plans?${result.error?'error=save':'success=saved'}`);
}
