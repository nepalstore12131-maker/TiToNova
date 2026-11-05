import sharp from 'sharp';
import type {SupabaseClient} from '@supabase/supabase-js';

const MAX_BYTES=3*1024*1024;
export async function saveJobPhotos(db:SupabaseClient,ownerId:string,jobId:string,files:FormDataEntryValue[]) {
 const uploads=files.filter((file):file is File=>file instanceof File && file.size>0);
 if(uploads.length>4) return false;
 for(const [index,file] of uploads.entries()){
  if(file.size>MAX_BYTES || !['image/jpeg','image/png','image/webp'].includes(file.type))return false;
  let image:Buffer;
  try{
   const original=Buffer.from(await file.arrayBuffer());
   const metadata=await sharp(original,{limitInputPixels:16000000}).metadata();
   if(!metadata.width||!metadata.height||metadata.pages && metadata.pages>1)return false;
   image=await sharp(original,{limitInputPixels:16000000}).rotate().resize({width:1600,height:1600,fit:'inside',withoutEnlargement:true}).webp({quality:80}).toBuffer();
  }catch{return false;}
  const objectPath=`${ownerId}/${jobId}/${crypto.randomUUID()}-${index}.webp`;
  const {error:uploadError}=await db.storage.from('job-photos').upload(objectPath,image,{contentType:'image/webp',upsert:false});
  if(uploadError)return false;
  const {error:rowError}=await db.from('job_photos').insert({job_id:jobId,employer_id:ownerId,object_path:objectPath});
  if(rowError){await db.storage.from('job-photos').remove([objectPath]);return false;}
 }
 return true;
}
