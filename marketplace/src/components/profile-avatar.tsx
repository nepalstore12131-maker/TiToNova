import {createClient} from '@/lib/supabase/server';
export async function ProfileAvatar({id,name='Member',size=44}:{id:string;name?:string;size?:number}) {
 const db=await createClient();
 const {data:photo}=db?await db.from('profile_photos').select('object_path').eq('id',id).maybeSingle():{data:null};
 const {data:signed}=db&&photo?.object_path?await db.storage.from('profile-photos').createSignedUrl(photo.object_path,300):{data:null};
 return <span className="profile-avatar" style={{width:size,height:size,minWidth:size}}>{signed?.signedUrl?<img src={signed.signedUrl} width={size} height={size} alt={`${name} profile photo`}/>:<span aria-label={`${name} profile`}>{name.trim().slice(0,1).toUpperCase()||'T'}</span>}</span>;
}
