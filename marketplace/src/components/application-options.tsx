'use client';
import {useEffect,useState,type ReactNode} from 'react';
import styles from './application-options.module.css';
type Option={id:string;label:string;content:ReactNode};
export function ApplicationOptions({options,initial=''}:{options:Option[];initial?:string}){
 const [open,setOpen]=useState(initial);
 useEffect(()=>{setOpen(initial);const fromHash=()=>{const hash=window.location.hash;const id=hash==='#conversation'?'messages':hash==='#interviews'?'interview':hash==='#samples'?'samples':'';if(id)setOpen(id);};fromHash();window.addEventListener('hashchange',fromHash);return()=>window.removeEventListener('hashchange',fromHash);},[initial]);
 return <div className={styles.options} aria-label="Application options">{options.map(option=><section className={styles.option} key={option.id}><button type="button" className={styles.toggle} aria-expanded={open===option.id} aria-controls={`application-option-${option.id}`} onClick={()=>setOpen(open===option.id?'':option.id)}><span>{option.label}</span><span aria-hidden="true">{open===option.id?'−':'+'}</span></button><div hidden={open!==option.id} id={`application-option-${option.id}`} className={styles.content}>{option.content}</div></section>)}</div>;
}
