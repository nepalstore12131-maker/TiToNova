'use server';
import sharp from 'sharp';
import {redirect} from 'next/navigation';
import {createClient} from '@/lib/supabase/server';
import {adDestination,adTypes} from '@/lib/advertising';
export type AdState={error:string};
const proofTypes:Record<string,string>={'image/jpeg':'jpg','image/png':'png','image/webp':'webp','application/pdf':'pdf'};
export async function submitAdvertisement(_:AdState,form:FormData):Promise<AdState>{
 const db=await createClient();if(!db)redirect('/login');const {data:{user}}=await db.auth.getUser();if(!user)redirect('/login');
 const {data:profile}=await db.from('profiles').select('role').eq('id',user.id).maybeSingle();if(profile?.role!=='employer')return {error:'An employer account is required.'};
 const id=String(form.get('request_id')||''),planId=String(form.get('plan_id')||''),revision=String(form.get('revision')||''),days=Number(form.get('days')),advertiser=String(form.get('advertiser')||'').trim(),title=String(form.get('title')||'').trim(),alt=String(form.get('alt')||'').trim(),url=String(form.get('url')||'').trim(),transaction=String(form.get('transaction')||'').trim(),method=String(form.get('method')||'');
 if(!/^[0-9a-f-]{36}$/i.test(id)||!/^[0-9a-f-]{36}$/i.test(planId))return {error:'Please refresh this form.'};
 const {data:existing}=await db.from('advertising_requests').select('id').eq('id',id).eq('employer_id',user.id).maybeSingle();if(existing)redirect('/dashboard/advertising?success=submitted');
 const {data:plan}=await db.from('advertising_plans').select('*').eq('id',planId).maybeSingle();
 if(!plan?.active||plan.daily_price_npr<1||plan.revision!==revision)return {error:'This plan changed. Refresh to see the latest price and requirements before paying. If you already paid, contact Help.'};
 if(!Number.isInteger(days)||days<1||days>plan.max_days||advertiser.length<2||advertiser.length>100||title.length<2||title.length>140||alt.length<2||alt.length>200||!adDestination(url)||transaction.length<4||transaction.length>120||!['esewa','khalti','bank'].includes(method)||form.get('consent')!=='on')return {error:'Complete the company details, secure HTTPS link, duration, payment and advertising consent.'};
 const artwork=form.get('artwork'),proof=form.get('proof');
 if(!(artwork instanceof File)||!adTypes.includes(artwork.type)||artwork.size<1||artwork.size>plan.max_mb*1048576)return {error:`Choose a JPG, PNG or WebP banner up to ${plan.max_mb} MB.`};
 if(!(proof instanceof File)||!proofTypes[proof.type]||proof.size<1||proof.size>2097152)return {error:'Payment proof must be a JPG, PNG, WebP or PDF up to 2 MB.'};
 let bytes:Buffer;
 try{const input=Buffer.from(await artwork.arrayBuffer());const meta=await sharp(input,{limitInputPixels:25000000}).metadata();const rotated=!!meta.orientation&&meta.orientation>=5;const width=rotated?meta.height:meta.width,height=rotated?meta.width:meta.height;
 if(!['jpeg','png','webp'].includes(meta.format||'')||(meta.pages||1)!==1||width!==plan.width||height!==plan.height)return {error:`Banner must be exactly ${plan.width} × ${plan.height} pixels, without animation. Your image is ${width} × ${height}.`};
 bytes=await sharp(input,{limitInputPixels:25000000}).rotate().webp({quality:90}).toBuffer();if(bytes.length>2097152)return {error:'The processed image is too large. Export a smaller file.'};
 }catch{return {error:'This image could not be read. Export a new JPG, PNG or WebP and try again.'};}
 const artworkPath=`${user.id}/${id}.webp`,proofPath=`${user.id}/${id}.${proofTypes[proof.type]}`;
 const a=await db.storage.from('advertising-artwork').upload(artworkPath,bytes,{contentType:'image/webp',upsert:false});
 if(a.error)return {error:'Artwork could not be uploaded. Refresh before trying again, or check your request history if already submitted.'};
 const p=await db.storage.from('advertising-proofs').upload(proofPath,proof,{contentType:proof.type,upsert:false});
 if(p.error){await db.storage.from('advertising-artwork').remove([artworkPath]);return {error:'Payment proof could not be uploaded. Please try again.'};}
 const result=await db.rpc('request_banner_ad',{p_id:id,p_plan:planId,p_revision:revision,p_days:days,p_advertiser:advertiser,p_title:title,p_alt:alt,p_url:url,p_artwork:artworkPath,p_proof:proofPath,p_method:method,p_transaction:transaction});
 if(result.error){const {data:committed}=await db.from('advertising_requests').select('id').eq('id',id).maybeSingle();if(committed)redirect('/dashboard/advertising?success=submitted');await Promise.all([db.storage.from('advertising-artwork').remove([artworkPath]),db.storage.from('advertising-proofs').remove([proofPath])]);return {error:'Could not submit. The plan may have changed or the transaction was already used. Check history and contact Help if you have already paid.'};}
 redirect('/dashboard/advertising?success=submitted');
}
