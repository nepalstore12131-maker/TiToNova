'use client';
import type {NotificationSection} from '@/lib/notification-sections';
import {useEffect} from 'react';
import {markSectionSeen} from '@/app/dashboard/notifications/seen-actions';
export function SectionSeen({section,openedAt}:{section:NotificationSection;openedAt:string}){
 useEffect(()=>{let running=false,done=false;const mark=async()=>{if(done||running||document.visibilityState!=='visible')return;running=true;try{const result=await markSectionSeen(section,openedAt);if(result.ok){done=true;window.dispatchEvent(new Event('titonova:notifications-read'));}}catch{}finally{running=false;}};void mark();document.addEventListener('visibilitychange',mark);return()=>document.removeEventListener('visibilitychange',mark);},[section,openedAt]);
 return null;
}
