import type { Metadata } from "next";

export const siteUrl = "https://www.titonova.com";
export const siteDescription = "Find jobs in Nepal or hire people for your home and business. Browse local and remote opportunities, apply, and manage work with Titonova.";

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
