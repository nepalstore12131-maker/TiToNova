"use client";
import { useEffect, useState } from "react";
type InstallPrompt = Event & { prompt(): Promise<void>; userChoice: Promise<{ outcome: string }> };
export function InstallApp() {
  const [prompt,setPrompt]=useState<InstallPrompt|null>(null);
  const [dismissed,setDismissed]=useState(true);
  useEffect(()=>{
    if ("serviceWorker" in navigator) navigator.serviceWorker.register("/sw.js",{scope:"/"}).catch(()=>{});
    setDismissed(localStorage.getItem("titonova-install-dismissed")==="1");
    const ready=(event:Event)=>{event.preventDefault();setPrompt(event as InstallPrompt);};
    const installed=()=>setPrompt(null);
    window.addEventListener("beforeinstallprompt",ready);window.addEventListener("appinstalled",installed);
    return ()=>{window.removeEventListener("beforeinstallprompt",ready);window.removeEventListener("appinstalled",installed);};
  },[]);
  if(!prompt||dismissed)return null;
  return <aside className="install-banner" aria-label="Install Titonova"><div><strong>Your next opportunity, one tap away.</strong><p>Add Titonova to your home screen.</p></div><button className="button small" onClick={async()=>{await prompt.prompt();await prompt.userChoice;setPrompt(null);}}>Install app</button><button className="install-dismiss" aria-label="Dismiss install suggestion" onClick={()=>{localStorage.setItem("titonova-install-dismissed","1");setDismissed(true);}}>×</button></aside>;
}
