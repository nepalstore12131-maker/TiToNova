import {ProfileAvatar} from '@/components/profile-avatar';
import {createClient} from '@/lib/supabase/server';
export async function CandidateSummary({id,name}:{id:string;name:string}){
 const db=await createClient();
 const result=db?await db.rpc('rating_summary',{p_recipient:id}).maybeSingle():null;
 const rating=result?.data as {average_rating:number|null;review_count:number}|null;
 return <div style={{display:'flex',alignItems:'center',gap:12,minWidth:0}}><ProfileAvatar id={id} name={name} size={44}/><div style={{minWidth:0}}><strong style={{overflowWrap:'anywhere'}}>{name}</strong><div style={{fontSize:12,color:'var(--muted)',marginTop:4}}>{!result||result.error?'Rating unavailable':rating?.review_count?`★ ${Number(rating.average_rating).toFixed(1)} / 5 · ${rating.review_count} reviews`:'☆ No ratings yet'}</div></div></div>;
}
