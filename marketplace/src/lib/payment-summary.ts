import type {SupabaseClient} from '@supabase/supabase-js';
export type PaymentSummary = {approved:number;pending:number;rejected:number;approvedCount:number;pendingCount:number;rejectedCount:number};
export function summarizePayments(rows:{amount_npr:number|string;status:string}[]):PaymentSummary {
 const totals={approved:0,pending:0,rejected:0,approvedCount:0,pendingCount:0,rejectedCount:0};
 for(const row of rows){
  if(!['approved','pending','rejected'].includes(row.status))continue;
  const value=Number(row.amount_npr);if(!Number.isFinite(value)||value<0)throw new Error('Invalid payment amount');
  const status=row.status as 'approved'|'pending'|'rejected';
  totals[status]+=Math.round(value*100);
  totals[`${status}Count`]++;
 }
 for(const status of ['approved','pending','rejected'] as const)totals[status]/=100;
 return totals;
}
// Uses the caller's authenticated client: database policies still limit visible records.
export async function loadPaymentSummary(db:SupabaseClient,employerId?:string):Promise<PaymentSummary|null>{
 const rows:{amount_npr:number|string;status:string}[]=[];
 let lastId:string|undefined;
 while(true){
  let query=db.from('employer_payment_requests').select('id,amount_npr,status').order('id').limit(500);
  if(employerId)query=query.eq('employer_id',employerId);
  if(lastId)query=query.gt('id',lastId);
  const {data,error}=await query;if(error||!data)return null;
  rows.push(...data);if(data.length<500)break;lastId=data[data.length-1].id;
 }
 try{return summarizePayments(rows);}catch{return null;}
}
export const formatNpr=(amount:number)=>`NPR ${amount.toLocaleString('en-NP',{minimumFractionDigits:2,maximumFractionDigits:2})}`;
