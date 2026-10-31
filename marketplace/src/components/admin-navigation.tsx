import Link from 'next/link';
import {UiIcon} from './workspace-ui';
import styles from './member-navigation.module.css';

export const adminGroups = [
  {label:'Jobs & hiring',icon:'briefcase',items:[
    {href:'/admin/jobs',label:'Review jobs'},
    {href:'/admin/listings',label:'All job posts'},
    
    {href:'/admin/applications',label:'Applications'},
    {href:'/dashboard/interviews',label:'Interviews'},
    {href:'/dashboard/work',label:'Work & agreements'},
  ]},
  {label:'People & trust',icon:'shield',items:[
    {href:'/admin/users',label:'Accounts'},
    {href:'/admin/employers',label:'Employer review'},
    {href:'/admin/reviews',label:'Ratings & feedback'},
    {href:'/admin/reports',label:'Job reports'},
    {href:'/admin/disputes',label:'Work disputes & suspensions'},
    {href:'/admin/messages',label:'Message moderation'},
  ]},
  {label:'Payments & advertising',icon:'wallet',items:[
    {href:'/admin/payments',label:'Revenue & payments'},
    {href:'/admin/promotions',label:'Paid promotions'},
    {href:'/admin/advertising',label:'Sponsored banners'},
  ]},
  {label:'Support & communication',icon:'message',items:[
    {href:'/admin/support',label:'Support inbox'},
    {href:'/admin/notices',label:'Notices & email'},
    {href:'/dashboard/email-settings',label:'My email preferences'},
  ]},
  {label:'Reports & settings',icon:'grid',items:[
    {href:'/admin/insights',label:'Results & revenue'},
    {href:'/admin/traffic',label:'Traffic & growth'},
    {href:'/admin/settings',label:'Marketplace settings'},
    {href:'/admin/payments/settings',label:'Premium settings'},
    {href:'/admin/categories',label:'Job categories'},
  ]},
];

export function AdminNavigation({activePath}:{activePath:string}) {
  const selected=adminGroups.flatMap(g=>g.items)
    .filter(i=>activePath===i.href||activePath.startsWith(i.href+'/'))
    .sort((a,b)=>b.href.length-a.href.length)[0]?.href;
  return <nav className={styles.navigation} aria-label="Administrator navigation" key={activePath}>
    <Link href="/admin" className={`${styles.overview} ${activePath==='/admin'?styles.current:''}`} aria-current={activePath==='/admin'?'page':undefined}><UiIcon name="grid" size={18}/><span>Overview</span></Link>
    <div className={styles.groups}>{adminGroups.map(group=>{
      const active=group.items.some(item=>item.href===selected);
      return <details className={styles.group} key={group.label} name="admin-sections" open={active}>
        <summary className={active?styles.activeGroup:undefined}><UiIcon name={group.icon} size={18}/><span>{group.label}</span><svg className={styles.chevron} viewBox="0 0 16 16" width="16" height="16" aria-hidden="true"><path d="m4 6 4 4 4-4" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg></summary>
        <div className={styles.items}>{group.items.map(item=><Link className={`${styles.item} ${selected===item.href?styles.current:''}`} href={item.href} key={item.href} aria-current={selected===item.href?'page':undefined}>{item.label}</Link>)}</div>
      </details>;
    })}</div>
  </nav>;
}
