"use client";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
export function MessageRefresh() {
  const router = useRouter();
  useEffect(() => {
    const timer = setInterval(() => {
      if (document.visibilityState === "visible" && !["TEXTAREA", "INPUT", "SELECT"].includes(document.activeElement?.tagName || "")) router.refresh();
    }, 20000);
    return () => clearInterval(timer);
  }, [router]);
  return <button className="button secondary small" type="button" onClick={() => router.refresh()}>Refresh messages ↻</button>;
}
