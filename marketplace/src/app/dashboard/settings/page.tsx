import {WorkspaceTabs} from '@/components/workspace-tabs';
import Link from 'next/link';
import {redirect} from 'next/navigation';
import {createClient} from '@/lib/supabase/server';
import {PortalShell,type AccountRole} from '@/components/portal-shell';
import {ProfileAvatar} from '@/components/profile-avatar';
import {PasswordField,AccountSubmit} from '@/components/account-form-controls';
import {changeEmail,changePassword,savePhoto,removePhoto,signOutOtherDevices} from './actions';
import './settings.css';
export const dynamic='force-dynamic';
const errors:Record<string,string>={
 'unavailable':'Account settings are temporarily unavailable. Please try again.',
 'current-password':'Your current password could not be verified. Check it and try again.',
 'rate-limit':'Too many attempts. Please wait before trying again.',
 'email-invalid':'Enter a valid email address.', 'email-same':'That is already your current email address.',
 'email-change':'We couldn’t request that email change. The address may be unavailable. Try again later.',
 'password-length':'Use at least 10 characters and at most 72 bytes for your new password.',
 'password-match':'Your new passwords do not match.', 'password-same':'Choose a new password different from your current password.',
 'password-weak':'Choose a stronger password that you do not use elsewhere.',
 'password-change':'Your password could not be updated. Please sign in again and retry, or use Forgot your password.',
 'sessions':'Other sessions could not be signed out. Please try again.',
 'photo-invalid':'Choose a JPG, PNG or WebP image up to 3 MB and 16 megapixels. Animated images are not supported.',
 'photo-unavailable':'Photo storage is temporarily unavailable. Your other settings still work.',
 'photo-upload':'The image could not be uploaded. Please try again.', 'photo-save':'Your photo could not be updated. Please try again.'
};
const success:Record<string,string>={
 'email-sent':'Email change requested. Follow the confirmation messages sent to your current and new email addresses. Your current address stays active until confirmation is complete.',
 'password-updated':'Password updated. Other devices must sign in again when their current access expires. This device stays signed in.',
 'password-only':'Password updated, but we couldn’t sign out other devices. Use the Other devices section below to try again.',
 'sessions':'Other devices must sign in again when their current access expires. This device stays signed in.',
 'photo':'Your profile photo was updated.', 'photo-removed':'Your profile photo was removed. Previously issued image links can remain valid for up to five minutes.',
 'photo-hidden':'Your profile photo is no longer displayed, but the old file could not be deleted. Please contact support for file removal.'
};
const one=(v:string|string[]|undefined)=>Array.isArray(v)?v[0]:v;
export default async function SettingsPage({searchParams}:{searchParams:Promise<Record<string,string|string[]|undefined>>}){
 const db=await createClient();if(!db)return <main className="dashboard"><p>Account settings are temporarily unavailable.</p></main>;
 const {data:{user}}=await db.auth.getUser();if(!user)redirect('/login?next=%2Fdashboard%2Fsettings');
 const {data:profile}=await db.from('profiles').select('full_name,company_name,role').eq('id',user.id).maybeSingle();
 if(!profile)return <main className="dashboard"><p>Your profile could not be loaded. Please refresh.</p></main>;
 if(!['freelancer','employer'].includes(profile.role))redirect('/dashboard');
 const params=await searchParams,err=errors[one(params.error)||''],notice=success[one(params.success)||''];
 const {data:photo,error:photoError}=await db.from('profile_photos').select('object_path').eq('id',user.id).maybeSingle();
 const name=profile.role==='employer'?(profile.company_name||profile.full_name):profile.full_name;
 return <PortalShell role={profile.role as AccountRole} activePath="/dashboard/settings"><div className="eyebrow">Your account, your control</div><h1>Account settings</h1><p className="settings-intro">Keep your profile recognizable and your sign-in details up to date.</p>
 {err&&<div className="form-alert" role="alert">{err}</div>}{notice&&<div className="setup-alert" role="status">{notice}</div>}

 <section className="dashboard-card account-summary"><ProfileAvatar id={user.id} name={name} size={76}/><div><h2>{name}</h2><p>{profile.role==='employer'?'Employer':'Job seeker'} · {user.email_confirmed_at?'Email verified':'Email not verified'}</p><Link href="/dashboard/profile">Edit {profile.role==='employer'?'company':'career'} profile ↗</Link></div></section>
 <p><Link href="/dashboard/email-settings">Manage email & job alert preferences →</Link></p><WorkspaceTabs initial={String(one(params.error)||one(params.success)||'').includes('password')?'password':String(one(params.error)||one(params.success)||'').includes('email')?'email':String(one(params.error)||one(params.success)||'').includes('sessions')?'devices':'photo'} tabs={[
{id:'photo',label:'Photo',icon:'profile',content:<><section className="dashboard-card settings-card" id="photo"><span className="eyebrow">Make it personal</span><h2>{profile.role==='employer'?'Company photo or logo':'Profile photo'}</h2><p>{profile.role==='employer'?'Your photo appears on your company page once you have a published job.':'Your photo is visible to you, admins, and active Premium employers whose roles you apply to.'}</p><p className="field-help">JPG, PNG or WebP · up to 3 MB. Photos are centered in a square, resized to 512 pixels, and location metadata is removed.</p>
 {photoError?<div className="setup-alert">Photo uploads are temporarily unavailable.</div>:<><form action={savePhoto} className="auth-form"><label htmlFor="photo-upload">Choose a photo</label><input id="photo-upload" type="file" name="photo" accept="image/jpeg,image/png,image/webp" required/><AccountSubmit pendingLabel="Uploading…">Upload photo →</AccountSubmit></form>{photo&&<form action={removePhoto} className="photo-remove"><AccountSubmit pendingLabel="Removing…">Remove photo</AccountSubmit></form>}</>}
 </section></>},
{id:'email',label:'Email',icon:'message',content:<><section className="dashboard-card settings-card" id="email"><span className="eyebrow">Stay connected</span><h2>Email address</h2><p className="current-email">Current: <strong>{user.email}</strong></p>{user.new_email&&<div className="setup-alert">Pending change: {user.new_email}. Check both inboxes to finish confirmation.</div>}<p>Your email stays private. Confirm the change using the emails sent by Titonova before using the new address to sign in.</p><form action={changeEmail} className="auth-form"><label htmlFor="new-email">New email address</label><input id="new-email" type="email" name="email" autoComplete="email" maxLength={254} required/><PasswordField id="email-password" name="current_password" label="Current password"/><AccountSubmit pendingLabel="Requesting…">Request email change →</AccountSubmit></form></section></>},
{id:'password',label:'Password',icon:'shield',content:<><section className="dashboard-card settings-card" id="password"><span className="eyebrow">Protect your account</span><h2>Change password</h2><p>Use at least 10 characters. Choose a unique password. Other devices will need to sign in again after their current access expires.</p><form action={changePassword} className="auth-form"><PasswordField id="current-password" name="current_password" label="Current password"/><PasswordField id="new-password" name="new_password" label="New password" autoComplete="new-password" minLength={10}/><PasswordField id="confirm-password" name="confirm_password" label="Confirm new password" autoComplete="new-password" minLength={10}/><AccountSubmit>Update password →</AccountSubmit></form><Link className="settings-recovery" href="/forgot-password">Forgot your current password?</Link></section></>},
{id:'devices',label:'Devices',icon:'grid',content:<><section className="dashboard-card settings-card" id="devices"><span className="eyebrow">You’re in control</span><h2>Sign out other devices</h2><p>Used a shared computer? End your other sign-in sessions while keeping this device signed in. Existing access can continue until its token expires.</p><form action={signOutOtherDevices} className="auth-form"><PasswordField id="devices-password" name="current_password" label="Current password"/><AccountSubmit pendingLabel="Signing out…">Sign out other devices →</AccountSubmit></form><div className="settings-note"><strong>Your account type stays the same.</strong><p>These settings do not change your applications, employer Premium, or account permissions.</p></div></section></>},
]}/></PortalShell>;
}
