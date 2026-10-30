import type {SupabaseClient} from '@supabase/supabase-js';
export async function getRetention(db:SupabaseClient){
 const {data,error}=await db.from('marketplace_controls').select('support_cleanup_enabled,support_retention_hours').eq('id',true).single();
 return error||!data?null:{enabled:data.support_cleanup_enabled as boolean,hours:data.support_retention_hours as number};
}
