'use server';
import {redirect} from 'next/navigation';
import {revalidatePath} from 'next/cache';
import {createClient} from '@/lib/supabase/server';
import {prepareProfilePhoto,MAX_PHOTO_BYTES} from '@/lib/profile-photo';
const settings='/dashboard/settings';
function fail(code:string):never {redirect(`${settings}?error=${code}`);}
async function context(){
 const db=await createClient();if(!db)fail('unavailable');
 const {data:{user}}=await db.auth.getUser();if(!user)redirect('/login?next=%2Fdashboard%2Fsettings');
 const {data:p}=await db.from('profiles').select('role').eq('id',user.id).maybeSingle();
 if(!p||!['freelancer','employer'].includes(p.role))redirect('/dashboard');
 return {db,user};
}
async function verifyPassword(db:NonNullable<Awaited<ReturnType<typeof createClient>>>,user:{id:string;email?:string},form:FormData){
 const password=String(form.get('current_password')||'');
 if(!user.email||!password||password.length>256)fail('current-password');
 const {data,error}=await db.auth.signInWithPassword({email:user.email,password});
 if(error||data.user?.id!==user.id)fail(error?.status===429?'rate-limit':'current-password');
}
export async function changeEmail(form:FormData){
 const {db,user}=await context();const email=String(form.get('email')||'').trim().toLowerCase();
 if(email.length>254||! /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))fail('email-invalid');
 if(email===user.email?.toLowerCase())fail('email-same');
 await verifyPassword(db,user,form);
 const {error}=await db.auth.updateUser({email},{emailRedirectTo:'https://www.titonova.com/auth/callback'});
 if(error)fail(error.status===429?'rate-limit':'email-change');
 revalidatePath(settings);redirect(`${settings}?success=email-sent`);
}
export async function changePassword(form:FormData){
 const {db,user}=await context();const password=String(form.get('new_password')||'');
 if(password.length<10||new TextEncoder().encode(password).length>72)fail('password-length');
 if(password!==String(form.get('confirm_password')||''))fail('password-match');
 if(password===String(form.get('current_password')||''))fail('password-same');
 await verifyPassword(db,user,form);
 const {error}=await db.auth.updateUser({password});
 if(error)fail(error.status===429?'rate-limit':error.code==='weak_password'?'password-weak':'password-change');
 const {error:sessionError}=await db.auth.signOut({scope:'others'});
 revalidatePath(settings);redirect(`${settings}?success=${sessionError?'password-only':'password-updated'}`);
}
export async function signOutOtherDevices(form:FormData){
 const {db,user}=await context();await verifyPassword(db,user,form);
 const {error}=await db.auth.signOut({scope:'others'});if(error)fail('sessions');
 redirect(`${settings}?success=sessions`);
}
export async function savePhoto(form:FormData){
 const {db,user}=await context();const file=form.get('photo');
 if(!(file instanceof File)||!file.size||file.size>MAX_PHOTO_BYTES||!['image/jpeg','image/png','image/webp'].includes(file.type))fail('photo-invalid');
 let bytes:Buffer;try{bytes=await prepareProfilePhoto(new Uint8Array(await file.arrayBuffer()));}catch{fail('photo-invalid');}
 const {data:old,error:readError}=await db.from('profile_photos').select('object_path').eq('id',user.id).maybeSingle();if(readError)fail('photo-unavailable');
 const path=`${user.id}/${crypto.randomUUID()}.webp`;
 const {error:uploadError}=await db.storage.from('profile-photos').upload(path,bytes,{contentType:'image/webp',upsert:false});if(uploadError)fail('photo-upload');
 const {error}=await db.from('profile_photos').upsert({id:user.id,object_path:path,updated_at:new Date().toISOString()});
 if(error){await db.storage.from('profile-photos').remove([path]);fail('photo-save');}
 if(old?.object_path)await db.storage.from('profile-photos').remove([old.object_path]);
 revalidatePath('/','layout');redirect(`${settings}?success=photo`);
}
export async function removePhoto(){
 const {db,user}=await context();const {data:old,error:readError}=await db.from('profile_photos').select('object_path').eq('id',user.id).maybeSingle();if(readError)fail('photo-unavailable');
 const {error}=await db.from('profile_photos').delete().eq('id',user.id);if(error)fail('photo-save');
 if(old?.object_path){const {error:cleanupError}=await db.storage.from('profile-photos').remove([old.object_path]);if(cleanupError){revalidatePath('/','layout');redirect(`${settings}?success=photo-hidden`);}}
 revalidatePath('/','layout');redirect(`${settings}?success=photo-removed`);
}
