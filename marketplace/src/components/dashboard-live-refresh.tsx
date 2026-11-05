"use client";

import { workspaceLiveTables } from "@/lib/workspace-live-tables";
import { useEffect } from "react";
import { createBrowserClient } from "@supabase/ssr";
import { usePathname, useRouter } from "next/navigation";

// Notification events update the open workspace, not just the badge.
// Quiet polling covers status changes that do not create a notification.
export function DashboardLiveRefresh() {
  const router = useRouter();
  const path = usePathname();
  useEffect(() => {
    let active = true;
    let pending = false;
    let debounce: ReturnType<typeof setTimeout> | undefined;
    const flush = () => {
      if (!active || !pending || document.visibilityState !== "visible") return;
      const focused = document.activeElement;
      if (focused?.matches("input, textarea, select, [contenteditable='true']")) return;
      pending = false;
      router.refresh();
    };
    const schedule = () => {
      pending = true;
      clearTimeout(debounce);
      debounce = setTimeout(flush, 250);
    };
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
    const client = url && key ? createBrowserClient(url, key) : null;
    let channel: ReturnType<NonNullable<typeof client>["channel"]> | null = null;
    if (client) void client.auth.getUser().then(({ data: { user } }) => {
      if (!active || !user) return;
      channel = client.channel(`workspace-membership-${user.id}`)
        .on("postgres_changes", {
          event: "UPDATE", schema: "public", table: "profiles", filter: `id=eq.${user.id}`,
        }, schedule)
        ;
      for (const table of workspaceLiveTables(path)) {
        channel.on("postgres_changes", { event: "INSERT", schema: "public", table }, schedule)
          .on("postgres_changes", { event: "UPDATE", schema: "public", table }, schedule);
      }
      channel.subscribe(status => { if (status === "SUBSCRIBED") schedule(); });
    }).catch(() => {});
    const timer = setInterval(schedule, 15000);
    window.addEventListener("titonova:workspace-changed", schedule);
    window.addEventListener("focus", schedule);
    document.addEventListener("visibilitychange", schedule);
    document.addEventListener("focusout", schedule);
    return () => {
      active = false;
      if (channel && client) void client.removeChannel(channel);
      clearInterval(timer);
      clearTimeout(debounce);
      window.removeEventListener("titonova:workspace-changed", schedule);
      window.removeEventListener("focus", schedule);
      document.removeEventListener("visibilitychange", schedule);
      document.removeEventListener("focusout", schedule);
    };
  }, [router, path]);
  return null;
}
