import type {ReactNode} from "react";
import Link from 'next/link';
export function UiIcon({name='arrow',size=20}:{name?:string;size?:number}){
 const paths:Record<string,string>={bank:'M3 10h18M4 10v9m5-9v9m6-9v9m5-9v9M2 21h20M12 3l10 5H2z',edit:'m16 3 5 5-12 12H4v-5zM14 5l5 5',calendar:'M4 5h16v16H4zM8 2v6m8-6v6M4 10h16',document:'M6 2h8l4 4v16H6zM14 2v5h4M9 12h6m-6 4h6',upload:'M12 16V3m-5 5 5-5 5 5M4 16v5h16v-5',star:'m12 3 3 6 7 1-5 5 1 7-6-3-6 3 1-7-5-5 7-1z',close:'m6 6 12 12M6 18 18 6',mail:'M3 5h18v14H3zM3 5l9 7 9-7',settings:'M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8M12 2v3m0 14v3M2 12h3m14 0h3M5 5l2 2m10 10 2 2M5 19l2-2M17 7l2-2',arrow:'M7 17 17 7M7 7h10v10',grid:'M3 3h7v7H3zM14 3h7v7h-7zM3 14h7v7h-7zM14 14h7v7h-7z',briefcase:'M8 6V3h8v3M3 7h18v14H3zM3 12h18M10 12v3h4v-3',people:'M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75',profile:'M20 21v-2a7 7 0 0 0-14 0v2M13 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8',shield:'M12 3 3 7v6c0 5 9 9 9 9s9-4 9-9V7zM8 12l3 3 5-6',message:'M21 15a3 3 0 0 1-3 3H7l-4 4V5a3 3 0 0 1 3-3h12a3 3 0 0 1 3 3z',spark:'m12 2 3 7 7 3-7 3-3 7-3-7-7-3 7-3z',wallet:'M3 6h16v15H3zM3 6V3h14M15 11h6v5h-6z',check:'m5 12 4 4L19 6',plus:'M12 5v14M5 12h14',clock:'M12 8v5l3 2M22 12a10 10 0 1 1-20 0 10 10 0 0 1 20 0'};
 return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.65" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={paths[name]||paths.arrow}/></svg>;
}
export function Metric({label,value,detail,href,icon='grid'}:{label:string;value:ReactNode;detail:string;href:string;icon?:string}){return <Link className="ws-metric" href={href}><div className="ws-metric-top"><span>{label}</span><UiIcon name={icon}/></div><strong>{value}</strong><small>{detail}</small></Link>;}
export function QuickAction({title,copy,href,icon}:{title:string;copy:string;href:string;icon:string}){return <Link className="ws-action" href={href}><span className="ws-action-icon"><UiIcon name={icon}/></span><div><strong>{title}</strong><p>{copy}</p></div><UiIcon size={17}/></Link>;}
export function SectionTitle({title,copy,href,link='View all'}:{title:string;copy?:string;href?:string;link?:string}){return <div className="ws-section-title"><div><h2>{title}</h2>{copy&&<p>{copy}</p>}</div>{href&&<Link href={href}>{link} ↗</Link>}</div>;}

export function iconForLabel(label:string){
 const v=label.toLowerCase();
 if(/bank|transfer/.test(v))return 'bank';
 if(/payment|billing|earning|npr|wallet/.test(v))return 'wallet';
 if(/edit|change/.test(v))return 'edit';
 if(/message|chat|support|contact/.test(v))return 'message';
 if(/interview|schedule|availability|calendar/.test(v))return 'calendar';
 if(/rating|review|feedback/.test(v))return 'star';
 if(/setting|password/.test(v))return 'settings';
 if(/email|alert|notification/.test(v))return 'mail';
 if(/upload|submit|send/.test(v))return 'upload';
 if(/cancel|reject|delete|remove|close/.test(v))return 'close';
 if(/save|accept|approve|complete|confirm/.test(v))return 'check';
 if(/profile|account|people|worker|applicant/.test(v))return 'people';
 if(/job|work|hire/.test(v))return 'briefcase';
 if(/history|time/.test(v))return 'clock';
 return 'document';
}
export function LabelIcon({label}:{label:string}){return <UiIcon name={iconForLabel(label)} size={17}/>;}
