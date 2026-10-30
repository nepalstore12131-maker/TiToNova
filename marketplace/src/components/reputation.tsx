import {createClient} from '@/lib/supabase/server';
export async function Reputation({id}:{id:string}){
 const db=await createClient();if(!db)return null;
 const [{data:s},{data:reviews}]=await Promise.all([db.rpc('rating_summary',{p_recipient:id}).maybeSingle(),db.rpc('public_work_reviews',{p_recipient:id})]);
 const summary=s as {average_rating:number|null;review_count:number}|null;
 return <section className="dashboard-card"><h2>Completed-work feedback</h2><p>{summary?.review_count?`★ ${summary.average_rating} / 5 · ${summary.review_count} reviews`:'No completed-work ratings yet.'}</p>{reviews?.map((r:{rating:number;feedback:string;author_role:string;created_at:string},i:number)=><article key={i}><strong>{r.rating} / 5 · From a {r.author_role}</strong><p style={{whiteSpace:'pre-wrap'}}>{r.feedback}</p><small>{new Date(r.created_at).toLocaleDateString('en-NP')}</small></article>)}</section>;
}
