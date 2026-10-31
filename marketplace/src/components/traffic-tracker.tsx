'use client';
import {useEffect,useRef} from 'react';
import {usePathname} from 'next/navigation';
import {trafficPage,trafficSource} from '@/lib/traffic';
export function TrafficTracker(){
 const path=usePathname();const last=useRef('');
 useEffect(()=>{
  const page=trafficPage(path);if(!page||last.current===path||navigator.doNotTrack==='1'||(navigator as Navigator&{globalPrivacyControl?:boolean}).globalPrivacyControl)return;
  if(!['www.titonova.com','titonova.com','titonova.vercel.app'].includes(location.hostname))return;
  try{
   let session=sessionStorage.getItem('titonova-visit');if(!session){session=crypto.randomUUID();sessionStorage.setItem('titonova-visit',session);}
   let source=sessionStorage.getItem('titonova-visit-source');if(!source){source=trafficSource(document.referrer);sessionStorage.setItem('titonova-visit-source',source);}
   last.current=path;
   void fetch('/api/traffic',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({event:crypto.randomUUID(),session,page,source}),keepalive:true}).catch(()=>{});
  }catch{/* Optional analytics must never interrupt the marketplace. */}
 },[path]);return null;
}
