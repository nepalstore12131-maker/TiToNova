import sharp from 'sharp';
import type {SupabaseClient} from '@supabase/supabase-js';

const MAX_BYTES=3*1024*1024;
const MAX_PHOTOS=4;

/** Validate every file before writing, then roll back a partial batch on failure. */
export async function saveJobPhotos(db:SupabaseClient,ownerId:string,jobId:string,files:FormDataEntryValue[]) {
 const uploads=files.filter((file):file is File=>file instanceof File && file.size>0);
 if(uploads.length>MAX_PHOTOS)return false;
 const prepared:{path:string;image:Buffer}[]=[];
 try{
  for(const [index,file] of uploads.entries()){
   if(file.size>MAX_BYTES||!['image/jpeg','image/png','image/webp'].includes(file.type))return false;
   const original=Buffer.from(await file.arrayBuffer());
   const metadata=await sharp(original,{limitInputPixels:16000000}).metadata();
   if(!metadata.width||!metadata.height||(metadata.pages&&metadata.pages>1))return false;
   const image=await sharp(original,{limitInputPixels:16000000}).rotate()
    .resize({width:1600,height:1600,fit:'inside',withoutEnlargement:true})
    .webp({quality:80}).toBuffer();
   prepared.push({path:`${ownerId}/${jobId}/${crypto.randomUUID()}-${index}.webp`,image});
  }
 }catch{return false;}
 const stored:string[]=[];
 const inserted:string[]=[];
 const rollback=async()=>{
  if(inserted.length){
   const {error}=await db.from('job_photos').delete().eq('job_id',jobId).in('object_path',inserted);
   if(error)console.error('Job photo row rollback failed',{code:error.code});
  }
  if(stored.length){
   const {error}=await db.storage.from('job-photos').remove(stored);
   if(error)console.error('Job photo storage rollback failed',{statusCode:error.statusCode});
  }
 };
 for(const {path,image} of prepared){
  const {error:uploadError}=await db.storage.from('job-photos').upload(path,image,{contentType:'image/webp',upsert:false});
  if(uploadError){await rollback();return false;}
  stored.push(path);
  const {error:rowError}=await db.from('job_photos').insert({job_id:jobId,employer_id:ownerId,object_path:path});
  if(rowError){await rollback();return false;}
  inserted.push(path);
 }
 return true;
}
