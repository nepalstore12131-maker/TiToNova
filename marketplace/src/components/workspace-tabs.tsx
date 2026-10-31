'use client';
import {useEffect,useRef,useState,type ReactNode} from 'react';
import {UiIcon} from './workspace-ui';
import styles from './workspace-tabs.module.css';
type Tab={id:string;label:string;icon?:string;content:ReactNode;attention?:boolean};
export function WorkspaceTabs({tabs,initial,aliases={}}:{tabs:Tab[];initial?:string;aliases?:Record<string,string>}){
 const [current,setCurrent]=useState(initial||tabs[0]?.id);const refs=useRef<Record<string,HTMLButtonElement|null>>({});
 const ids=tabs.map(t=>t.id).join('|'),aliasKey=JSON.stringify(aliases);
 useEffect(()=>{setCurrent(initial||ids.split('|')[0]);const selectHash=()=>{const hash=window.location.hash.slice(1);const target=JSON.parse(aliasKey)[hash]||hash;if(ids.split('|').includes(target))setCurrent(target);};selectHash();window.addEventListener('hashchange',selectHash);return()=>window.removeEventListener('hashchange',selectHash);},[initial,ids,aliasKey]);
 const move=(index:number)=>{const id=tabs[(index+tabs.length)%tabs.length].id;setCurrent(id);refs.current[id]?.focus();};
 return <section className={styles.workspace}><div className={styles.tabs} role="tablist" aria-label="Page sections">{tabs.map((tab,i)=><button ref={el=>{refs.current[tab.id]=el;}} key={tab.id} id={`tab-${tab.id}`} role="tab" type="button" aria-selected={current===tab.id} aria-controls={`panel-${tab.id}`} tabIndex={current===tab.id?0:-1} onClick={()=>setCurrent(tab.id)} onKeyDown={e=>{if(['ArrowRight','ArrowLeft','Home','End'].includes(e.key)){e.preventDefault();move(e.key==='Home'?0:e.key==='End'?tabs.length-1:i+(e.key==='ArrowRight'?1:-1));}}}><UiIcon name={tab.icon||'grid'} size={17}/>{tab.label}{tab.attention&&<span className={styles.dot} aria-label="Needs attention"/>}</button>)}</div>{tabs.map(tab=><div key={tab.id} id={`panel-${tab.id}`} role="tabpanel" aria-labelledby={`tab-${tab.id}`} hidden={current!==tab.id} className={styles.panel} onInvalidCapture={()=>setCurrent(tab.id)}>{tab.content}</div>)}</section>;
}
