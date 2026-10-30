'use client';
import {useState} from 'react';
import {useFormStatus} from 'react-dom';
export function PasswordField({id,label,name,autoComplete='current-password',minLength=1}:{id:string;label:string;name:string;autoComplete?:string;minLength?:number}) {
 const [visible,setVisible]=useState(false);
 return <div className="password-field"><label htmlFor={id}>{label}</label><div><input id={id} name={name} type={visible?'text':'password'} autoComplete={autoComplete} minLength={minLength} maxLength={autoComplete==='current-password'?256:72} required/><button type="button" aria-label={`${visible?'Hide':'Show'} ${label.toLowerCase()}`} aria-pressed={visible} onClick={()=>setVisible(!visible)}>{visible?'Hide':'Show'}</button></div></div>;
}
export function AccountSubmit({children,pendingLabel='Saving…'}:{children:React.ReactNode;pendingLabel?:string}) {
 const {pending}=useFormStatus();
 return <button className="button" type="submit" disabled={pending}>{pending?pendingLabel:children}</button>;
}
