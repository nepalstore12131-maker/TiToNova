import type { Metadata, Viewport } from "next";
import Link from "next/link";
import "./globals.css";
import "./luxury.css";
import "./support.css";
import {HelpButton} from "@/components/help-button";
import { InstallApp } from "@/components/install-app";

export const metadata: Metadata = {
  title: "Titonova — Work and talent, connected in Nepal",
  appleWebApp: { capable: true, statusBarStyle: "default", title: "Titonova" },
  icons: { icon: [{ url: "/brand/titonova-icon.png", type: "image/png", sizes: "512x512" }], apple: "/brand/titonova-icon.png" },
  description:
    "A Nepal-focused marketplace connecting independent professionals with employers.",
};

export const viewport: Viewport = { themeColor: "#2c302b", width: "device-width", initialScale: 1 };

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}<nav className="site-languages" aria-label="Language"><span>Language / भाषा</span><Link href="/" lang="en">English</Link><Link href="/ne" lang="ne">नेपाली</Link></nav><nav className="support-footer-links" aria-label="Support"><Link href="/help">Help centre</Link><Link href="/contact">Contact us</Link></nav><InstallApp /><HelpButton /></body>
    </html>
  );
}
