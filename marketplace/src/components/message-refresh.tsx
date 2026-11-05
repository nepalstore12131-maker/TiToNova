"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createBrowserClient } from "@supabase/ssr";

export function MessageRefresh({ applicationId, latestMessageId }: { applicationId: string; latestMessageId: string }) {
  const router = useRouter();
  const [hasUpdates,setHasUpdates]=useState(false);
  useEffect(()=>setHasUpdates(false),[latestMessageId]);
  useEffect(() => {
    let active = true;
    const refresh = () => {
      if (active && document.visibilityState === "visible" &&
        !["TEXTAREA", "INPUT", "SELECT"].includes(document.activeElement?.tagName || "")) {
        router.refresh();
      }
    };
    const onMessage=()=>{setHasUpdates(true);refresh();};
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
    const client = url && key ? createBrowserClient(url, key) : null;
    const channel = client?.channel(`application-messages-${applicationId}`)
      .on("postgres_changes", {
        event: "INSERT", schema: "public", table: "application_messages",
        filter: `application_id=eq.${applicationId}`,
      }, onMessage)
      .subscribe();
    const afterEditing = () => { queueMicrotask(refresh); };
    const timer = setInterval(refresh, 20000);
    document.addEventListener("focusout", afterEditing);
    document.addEventListener("visibilitychange", refresh);
    return () => {
      active = false;
      clearInterval(timer);
      document.removeEventListener("focusout", afterEditing);
      document.removeEventListener("visibilitychange", refresh);
      if (channel && client) void client.removeChannel(channel);
    };
  }, [router, applicationId]);
  return <small role="status">{hasUpdates ? "New message — updates when you finish typing" : "Messages update automatically"}</small>;
}
