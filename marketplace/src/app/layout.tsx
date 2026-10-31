import type { Metadata, Viewport } from "next";
import { publicMetadata, siteDescription, siteUrl } from "@/lib/seo";
import Link from "next/link";
import "./globals.css";
import "./luxury.css";
import "./support.css";
import "./dark-mode.css";
import {ThemeToggle} from "@/components/theme-toggle";
import {HelpButton} from "@/components/help-button";
import {TrafficTracker} from "@/components/traffic-tracker";
import { InstallApp } from "@/components/install-app";

export const metadata: Metadata = {
  ...publicMetadata("Jobs in Nepal & Hiring | Titonova", siteDescription, "/"),
  metadataBase: new URL(siteUrl),
  alternates: undefined,
  appleWebApp: { capable: true, statusBarStyle: "default", title: "Titonova" },
  icons: { icon: [{ url: "/brand/titonova-icon.png", type: "image/png", sizes: "512x512" }], apple: "/brand/titonova-icon.png" },
  description: siteDescription,
};

export const viewport: Viewport = { themeColor: "#2c302b", width: "device-width", initialScale: 1 };

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head><script dangerouslySetInnerHTML={{__html:`try{document.documentElement.dataset.theme=localStorage.getItem('titonova-theme')==='dark'?'dark':'light'}catch(e){document.documentElement.dataset.theme='light'}`}}/></head>
      <body><TrafficTracker/>{children}<nav className="site-languages" aria-label="Language"><span>Language / भाषा</span><Link href="/" lang="en">English</Link><Link href="/ne" lang="ne">नेपाली</Link></nav><nav className="support-footer-links" aria-label="Support"><Link href="/help">Help centre</Link><Link href="/contact">Contact us</Link></nav><InstallApp /><ThemeToggle/><HelpButton /></body>
    </html>
  );
}
