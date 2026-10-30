import type {SupabaseClient} from '@supabase/supabase-js';
export type RevenueTotal={amount:number;count:number}|null;
// Keyset pagination avoids silently truncating totals at the API row limit.
export async function approvedRevenue(db:SupabaseClient,table:string,start:string,end:string):Promise<RevenueTotal>{
 let after:string|undefined;let cents=0,count=0;
 while(true){let q=db.from(table).select('id,amount_npr').eq('status','approved').gte('reviewed_at',start).lt('reviewed_at',end).order('id').limit(500);if(after)q=q.gt('id',after);const {data,error}=await q;if(error||!data)return null;for(const row of data){const amount=Number(row.amount_npr);if(!Number.isFinite(amount)||amount<0)return null;cents+=Math.round(amount*100);count++;}if(data.length<500)return {amount:cents/100,count};after=data[data.length-1].id;}
}
export async function jobsWithoutApplications(db:SupabaseClient){
 let after:string|undefined;let count=0;const examples:{id:string;title:string}[]=[];
 while(true){let q=db.from('jobs').select('id,title,applications(count)').eq('status','published').is('archived_at',null).order('id').limit(500);if(after)q=q.gt('id',after);const {data,error}=await q;if(error||!data)return null;for(const row of data){if(row.applications?.[0]?.count===0){count++;if(examples.length<8)examples.push({id:row.id,title:row.title});}}if(data.length<500)return {count,examples};after=data[data.length-1].id;}
}
