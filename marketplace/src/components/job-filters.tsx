'use client';
import {useState,type ReactNode} from 'react';
import {UiIcon} from './workspace-ui';
export function JobFilters({children,label,caption}:{children:ReactNode;label:string;caption:string}){
 const [open,setOpen]=useState(false);
 return <aside className="market-filter-panel"><div className="market-filter-title"><div><UiIcon name="grid" size={18}/><h2>{label}</h2></div><p>{caption}</p></div><button type="button" className="market-filter-toggle" aria-expanded={open} aria-controls="job-filters" onClick={()=>setOpen(!open)}><UiIcon name="grid" size={17}/>{label}<span>{open?'−':'+'}</span></button><div id="job-filters" className={`market-filter-body ${open?'is-open':''}`}>{children}</div></aside>;
}
