'use client';
import {useActionState,useState} from 'react';
import {previewNotice,sendNotice,type NoticePreview} from '@/app/admin/notices/actions';
import {AccountSubmit} from './account-form-controls';
export function AdminNoticeForm(){
 const [state,action,pending]=useActionState<NoticePreview,FormData>(previewNotice,{});const [editing,setEditing]=useState(true);
 const draft=state.draft;
 return <section className="dashboard-card"><h2>Send a notice</h2>{state.error&&<p className="form-alert" role="alert">{state.error}</p>}
 {(editing||!draft||pending)&&<form action={f=>{setEditing(false);action(f);}} className="auth-form">
 <label htmlFor="notice-audience">Who should receive this?</label><select id="notice-audience" name="audience" defaultValue={draft?.audience||'both'} required><option value="both">Workers and employers</option><option value="freelancer">Workers only</option><option value="employer">Employers only</option></select>
 <label htmlFor="notice-title">Title</label><input id="notice-title" name="title" defaultValue={draft?.title||''} minLength={3} maxLength={140} required/>
 <label htmlFor="notice-body">Message</label><textarea id="notice-body" name="body" defaultValue={draft?.body||''} rows={6} minLength={10} maxLength={4000} required/>
 <button className="button" disabled={pending}>{pending?'Preparing preview…':'Preview audience & message'}</button></form>}
 {draft&&!editing&&!pending&&<div><span className="eyebrow">Preview — not sent</span><h3>{draft.title}</h3><p style={{whiteSpace:'pre-wrap'}}>{draft.body}</p><p><strong>{draft.count} accounts</strong> · {draft.audience==='both'?'Workers and employers':draft.audience==='freelancer'?'Workers only':'Employers only'}</p><p>Every selected account receives an in-app notice. Email is queued only for members who enabled Titonova notices. Sending does not mark notifications as read.</p><form action={sendNotice} className="auth-form">{Object.entries(draft).map(([k,v])=><input key={k} type="hidden" name={k} value={v}/>)}<label><input style={{width:18,height:18}} type="checkbox" name="confirm" required/> I checked the message and audience.</label><AccountSubmit pendingLabel="Sending…">Send notice</AccountSubmit></form><button className="text-button" onClick={()=>setEditing(true)}>Edit before sending</button></div>}
 </section>;
}
