import {createClient} from '@/lib/supabase/server';
export async function SponsorBanner({placement}:{placement:'home'|'jobs'}){
 const db=await createClient();if(!db)return null;const now=new Date().toISOString();
 const {data}=await db.from('sponsor_banners').select('*').eq('placement',placement).eq('active',true).lte('starts_at',now).or(`ends_at.is.null,ends_at.gt.${now}`).order('sort_order').order('created_at').limit(2);
 if(!data?.length)return null;
 return <aside aria-label="Sponsored advertisements" style={{maxWidth:1200,margin:'24px auto',padding:'0 20px'}}>{data.map(b=>{const image=db.storage.from('sponsor-banners').getPublicUrl(b.image_path).data.publicUrl;return <div key={b.id} style={{marginBottom:20}}><small style={{display:'block',marginBottom:6,color:'var(--muted)'}}>Advertisement · {b.advertiser}</small><a href={b.target_url} target="_blank" rel="sponsored noopener noreferrer" style={{display:'block',borderRadius:20,overflow:'hidden',border:'1px solid var(--line)'}}><img src={image} alt={b.alt_text} loading="lazy" style={{width:'100%',height:'auto',maxHeight:360,objectFit:'contain',display:'block',background:'var(--surface)'}}/><span style={{display:'block',padding:12}}>{b.title} ↗</span></a></div>;})}</aside>;
}
