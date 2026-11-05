"use client";
import Link from 'next/link';
import {createBrowserClient} from '@supabase/ssr';
import {useEffect,useState} from 'react';
import {usePathname} from 'next/navigation';
export function NotificationBell(){
 const [count,setCount]=useState<number|null>(null);const path=usePathname();
 useEffect(()=>{let alive=true;let generation=0;const controller=new AbortController();const refresh=async()=>{if(document.visibilityState!=='visible')return;const version=++generation;try{const r=await fetch('/api/notifications/count',{cache:'no-store',signal:controller.signal});if(r.ok){const data=await r.json();if(alive&&version===generation)setCount(data.count);}}catch{}};void refresh();
 const url=process.env.NEXT_PUBLIC_SUPABASE_URL,key=process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
 const client=url&&key?createBrowserClient(url,key):null;
 let channel:ReturnType<NonNullable<typeof client>['channel']>|null=null;
 if(client)void client.auth.getUser().then(({data:{user}})=>{
  if(!alive||!user)return;
  channel=client.channel(`notification-updates-${user.id}`)
   .on('postgres_changes',{event:'*',schema:'public',table:'notifications',filter:`recipient_id=eq.${user.id}`},()=>{window.dispatchEvent(new Event('titonova:notifications-read'));window.dispatchEvent(new Event('titonova:workspace-changed'));})
   .subscribe();
 }).catch(()=>{});
 const timer=setInterval(refresh,30000);document.addEventListener('visibilitychange',refresh);window.addEventListener('titonova:notifications-read',refresh);return()=>{alive=false;if(channel&&client)void client.removeChannel(channel);controller.abort();clearInterval(timer);document.removeEventListener('visibilitychange',refresh);window.removeEventListener('titonova:notifications-read',refresh);};},[path]);
 return <Link className="notification-bell" href="/dashboard/notifications" aria-label={count?`Notifications, ${count} unread`:'Notifications'}><svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden="true"><path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9M10 21h4"/></svg><span className="notification-label">Notifications</span>{count!==null&&count>0&&<span className="notification-count">{count>99?'99+':count}</span>}</Link>;
}
