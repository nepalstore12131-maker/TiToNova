'use client';
import {useState,type ReactNode} from 'react';
import {UiIcon} from './workspace-ui';
import styles from './workspace-menu.module.css';
export function WorkspaceMenu({children,activePath}:{children:ReactNode;activePath:string}){
 const [open,setOpen]=useState(false);
 const labels:Record<string,string>={work:'My work',applications:'Applications',hiring:'Hiring',jobs:'Jobs',settings:'Account settings',profile:'Profile',billing:'Payments',interviews:'Interviews',invitations:'Invitations',support:'Support',reviews:'Ratings',promotions:'Promotions',advertising:'Advertising','email-settings':'Email preferences'};
 const section=activePath.split('/')[2];
 return <div className={styles.menu}><button className={styles.toggle} type="button" onClick={()=>setOpen(!open)} aria-expanded={open} aria-controls="workspace-menu-content"><span><UiIcon name="grid" size={18}/> Workspace menu</span><strong>{labels[section]||'Home'} <span aria-hidden="true">{open?'−':'+'}</span></strong></button><div id="workspace-menu-content" className={`${styles.content} ${open?styles.open:''}`}>{children}</div></div>;
}
