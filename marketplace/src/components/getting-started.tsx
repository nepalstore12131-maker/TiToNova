"use client";
import Link from 'next/link';
import {useEffect,useState} from 'react';
import styles from './getting-started.module.css';
type Props={accountId:string;employer:boolean;profileReady:boolean;premium:boolean;hasActivity:boolean;activityKnown:boolean};
export function GettingStarted({accountId,employer,profileReady,premium,hasActivity,activityKnown}:Props){
 const key=`titonova-guide-v1:${accountId}`;
 const [open,setOpen]=useState(!hasActivity);
 useEffect(()=>{try{const saved=localStorage.getItem(key);setOpen(saved?saved!=='hidden':!hasActivity);}catch{}},[key,hasActivity]);
 function toggle(){const next=!open;setOpen(next);try{localStorage.setItem(key,next?'open':'hidden');}catch{}}
 const steps=employer?[
  {title:'Introduce yourself',copy:'Hiring for your home or business? Add a short introduction. A company name is optional.',href:'/dashboard/profile',action:'Edit hiring profile',done:profileReady},
  {title:'Activate hiring access',copy:premium?'Your Premium access is active. You can post a job.':'Check the price and payment instructions. Posting opens after your Premium payment is approved.',href:'/dashboard/billing',action:'View Premium',done:premium},
  {title:'Post your first job',copy:'Describe the work, location and pay. Application dates and a work deadline are optional.',href:'/dashboard/jobs/new',action:premium?'Post a job':'View posting form',done:activityKnown&&hasActivity},
  {title:'Choose a worker',copy:'Open Applications received and choose a worker. Then open My work to send terms, follow progress and confirm completion.',href:'/dashboard/applications',action:'View applications',done:false},
 ]:[
  {title:'Introduce yourself',copy:'Add a short introduction and your skills. A CV, photo and work samples can help, but are optional.',href:'/dashboard/profile',action:'Edit my profile',done:profileReady},
  {title:'Find work that fits',copy:'Browse jobs by location, category and work type. Read the pay and application dates before applying.',href:'/jobs',action:'Browse jobs',done:false},
  {title:'Send an application',copy:'Introduce yourself to the hirer. Share work samples only if you want to. Track replies in My applications.',href:'/dashboard/applications',action:'My applications',done:activityKnown&&hasActivity},
  {title:'Complete the work',copy:'Open My work, agree on the terms and start. Submit the finished work; after the employer confirms it, leave a rating.',href:'/dashboard/work',action:'My work',done:false},
 ];
 return <section className={styles.guide} aria-label="Getting started"><div className={styles.heading}><div><span className="eyebrow">How it works</span><h2>{employer?'Hire in four steps':'Find work in four steps'}</h2><p>New here? Open this guide. Already working? Continue from My work.</p></div><button type="button" className={styles.toggle} onClick={toggle} aria-expanded={open} aria-controls="getting-started-steps">{open?'Hide guide':'Show guide'}</button></div>{open&&<div id="getting-started-steps"><ol className={styles.steps}>{steps.map((step,index)=><li key={step.title}><span className={styles.number} aria-hidden="true">{step.done?'✓':String(index+1).padStart(2,'0')}</span><h3>{step.title}</h3>{step.done&&<small className={styles.done}>Done</small>}<p>{step.copy}</p><Link href={step.href}>{step.action} →</Link></li>)}</ol><p className={styles.help}>Stuck on a step? <Link href="/dashboard/support">Ask Titonova for help →</Link></p></div>}</section>;
}
