import Link from 'next/link';
import {UiIcon} from './workspace-ui';
import styles from './member-navigation.module.css';
type Item={href:string;label:string};
export function MemberNavigation({role,activePath}:{role:'freelancer'|'employer';activePath:string}){
 const employer=role==='employer';
 const groups:{label:string;icon:string;items:Item[]}[]=[
  {label:'Work',icon:'briefcase',items:employer?[
   {href:'/services',label:'Find a service'},
   {href:'/dashboard/service-requests',label:'Service requests'},
   {href:'/dashboard/hiring',label:'Hiring dashboard'},
   {href:'/dashboard/saved-workers',label:'Saved workers & hire again'},
   {href:'/dashboard/invitations',label:'Hiring invitations'},
   {href:'/dashboard/jobs',label:'My job posts'},
   {href:'/dashboard/jobs/new',label:'Post a job'},
   {href:'/dashboard/applications',label:'Applications received'},
   {href:'/dashboard/interviews',label:'Interviews'},
   {href:'/dashboard/work',label:'My work'},
  ]:[{href:'/dashboard/services',label:'My services'},{href:'/dashboard/service-requests',label:'Service requests'},{href:'/jobs',label:'Find work'},{href:'/dashboard/invitations',label:'Hiring invitations'},{href:'/dashboard/applications',label:'My applications'},{href:'/dashboard/interviews',label:'Interviews'},{href:'/dashboard/work',label:'My work'}]},
  {label:'Payments',icon:'wallet',items:employer?[{href:'/dashboard/billing',label:'Premium & billing'},{href:'/dashboard/promotions',label:'Promote a job'},{href:'/dashboard/advertising',label:'Advertise your business'}]:[{href:'/dashboard/earnings',label:'My earnings'}]},
  {label:'My account',icon:'profile',items:[{href:'/dashboard/profile',label:employer?'Hiring profile':'My profile'},{href:'/dashboard/reviews',label:'Ratings & feedback'},{href:'/dashboard/settings',label:'Account settings'}]},
  {label:'Support',icon:'message',items:[{href:'/dashboard/disputes',label:'Work problems & appeals'},{href:'/dashboard/support',label:'My support conversations'},{href:'/help',label:'Help centre'},{href:'/contact',label:'Contact Titonova'}]},
 ];
 const selected=groups.flatMap(g=>g.items).filter(i=>activePath===i.href||activePath.startsWith(i.href+'/')).sort((a,b)=>b.href.length-a.href.length)[0]?.href;
 return <nav className={styles.navigation} aria-label="Workspace navigation" key={activePath}>
  <Link href="/dashboard" className={`${styles.overview} ${activePath==='/dashboard'?styles.current:''}`} aria-current={activePath==='/dashboard'?'page':undefined}><UiIcon name="grid" size={18}/><span>Overview</span></Link>
  <div className={styles.groups}>{groups.map(group=>{const active=group.items.some(i=>i.href===selected);return <details className={styles.group} key={group.label} name="workspace-sections" open={active}>
   <summary className={active?styles.activeGroup:undefined}><UiIcon name={group.icon} size={18}/><span>{group.label}</span><svg className={styles.chevron} viewBox="0 0 16 16" width="16" height="16" aria-hidden="true"><path d="m4 6 4 4 4-4" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg></summary>
   <div className={styles.items}>{group.items.map(item=><Link className={`${styles.item} ${selected===item.href?styles.current:''}`} href={item.href} key={item.href} aria-current={selected===item.href?'page':undefined}>{item.label}</Link>)}</div>
  </details>;})}</div>
 </nav>;
}
