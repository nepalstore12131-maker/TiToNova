'use server';
import sharp from 'sharp';
import {redirect} from 'next/navigation';
import {requireAdminContext} from '@/lib/supabase/admin';
import {adDestination} from '@/lib/advertising';
export async function reviewAdvertisement(form:FormData){
 const {sessionClient:db}=await requireAdminContext();const id=String(form.get('id')||''),decision=String(form.get('decision')||''),note=String(form.get('note')||'').trim();if(!['approve','reject'].includes(decision)||note.length>1000||(decision==='reject'&&note.length<5)||(decision==='approve'&&(form.get('verified')!=='on'||form.get('artwork_checked')!=='on')))redirect('/admin/advertising/requests?error=verify');
 if(decision==='approve'){
 const {data:r}=await db.from('advertising_requests').select('*').eq('id',id).eq('status','pending').maybeSingle();if(!r||!adDestination(r.target_url))redirect('/admin/advertising/requests?error=artwork');
 const {data:file,error}=await db.storage.from('advertising-artwork').download(r.artwork_path);if(error||!file)redirect('/admin/advertising/requests?error=artwork');
 try{const meta=await sharp(Buffer.from(await file.arrayBuffer()),{limitInputPixels:25000000}).metadata();if(meta.format!=='webp'||(meta.pages||1)!==1||meta.width!==r.width||meta.height!==r.height)throw Error();}catch{redirect('/admin/advertising/requests?error=artwork');}
 }
 const {error}=await db.rpc('review_banner_ad',{p_request:id,p_approve:decision==='approve',p_note:note});redirect(`/admin/advertising/requests?${error?'error=review':'success=reviewed'}`);
}
export async function pausePaidBanner(form:FormData){const {sessionClient:db}=await requireAdminContext();const {error}=await db.from('sponsor_banners').update({active:false}).eq('id',String(form.get('banner_id')||'')).eq('image_bucket','advertising-artwork');redirect(`/admin/advertising/requests?${error?'error=review':'success=paused'}`);}
