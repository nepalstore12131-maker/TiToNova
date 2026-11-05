import type {SupabaseClient} from '@supabase/supabase-js';

/** Called only after the server action authenticates an admin and validates DELETE. */
export async function deleteAccountWithFiles(client:SupabaseClient,id:string){
 const {data:files,error:lookupError}=await client.rpc('account_deletion_files',{p_account:id});
 if(lookupError)return {error:lookupError,stage:'files' as const};
 const buckets=new Map<string,string[]>();
 for(const file of (files||[]) as {bucket_id:string;object_name:string}[]){
  const paths=buckets.get(file.bucket_id)||[];paths.push(file.object_name);buckets.set(file.bucket_id,paths);
 }
 for(const [bucket,paths] of buckets){
  for(let offset=0;offset<paths.length;offset+=100){
   const {error}=await client.storage.from(bucket).remove(paths.slice(offset,offset+100));
   if(error)return {error,stage:'files' as const};
  }
 }
 const {error}=await client.auth.admin.deleteUser(id);
 return {error,stage:'account' as const};
}
