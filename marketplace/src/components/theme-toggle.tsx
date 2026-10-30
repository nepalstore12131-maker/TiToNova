'use client';
import {useEffect,useState} from 'react';
const key='titonova-theme';
/** Light remains the default. This preference belongs to the browser, not a paid account. */
export function ThemeToggle(){
 const [dark,setDark]=useState(false);
 useEffect(()=>{setDark(document.documentElement.dataset.theme==='dark');const sync=(e:StorageEvent)=>{if(e.key===key||e.key===null){const enabled=e.newValue==='dark';document.documentElement.dataset.theme=enabled?'dark':'light';setDark(enabled);}};window.addEventListener('storage',sync);return()=>window.removeEventListener('storage',sync);},[]);
 const toggle=()=>{const next=!dark;setDark(next);document.documentElement.dataset.theme=next?'dark':'light';try{localStorage.setItem(key,next?'dark':'light');}catch{/* The toggle still works when browser storage is unavailable. */}};
 return <button className="theme-toggle" type="button" role="switch" aria-checked={dark} aria-label="Dark mode" title={dark?'Turn off dark mode':'Turn on dark mode'} onClick={toggle}><svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden="true">{dark?<><circle cx="12" cy="12" r="4"/><path d="M12 2v2m0 16v2M2 12h2m16 0h2M5 5l1.5 1.5m11 11L19 19M5 19l1.5-1.5m11-11L19 5"/></>:<path d="M20 15.4A8.5 8.5 0 0 1 8.6 4a8.5 8.5 0 1 0 11.4 11.4Z"/>}</svg><span>{dark?'Light mode':'Dark mode'}</span></button>;
}
