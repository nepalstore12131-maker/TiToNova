import type { Metadata } from "next";

export const siteUrl = "https://www.titonova.com";
export const siteDescription = "Find jobs in Nepal and remote opportunities with employers worldwide. Hire Nepal-based professionals from anywhere, browse local work, and manage hiring on Titonova.";

export function publicMetadata(title: string, description: string, path: string): Metadata {
  const url = `${siteUrl}${path}`;
  return {
    title, description,
    alternates: { canonical: url },
    openGraph: { title, description, url, siteName: "Titonova", type: "website", images: [{ url: `${siteUrl}/brand/titonova-icon.png`, width: 512, height: 512, alt: "Titonova" }] },
    twitter: { card: "summary", title, description, images: [`${siteUrl}/brand/titonova-icon.png`] },
  };
}

export const privateMetadata: Metadata = { robots: { index: false, follow: false } };
