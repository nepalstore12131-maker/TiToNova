import type { MetadataRoute } from "next";
import { createClient } from "@supabase/supabase-js";
import { getSupabaseConfig } from "@/lib/supabase/config";
import { siteUrl } from "@/lib/seo";

export const revalidate = 3600;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const pages: MetadataRoute.Sitemap = ["/", "/ne", "/jobs", "/help", "/contact"].map(path => ({ url: `${siteUrl}${path}` }));
  const config = getSupabaseConfig();
  if (!config) return pages;
  // Anonymous access uses the same public row policies as visitors, never an admin key.
  const db = createClient(config.url, config.key, { auth: { persistSession: false, autoRefreshToken: false } });
  for (let offset = 0; offset < 49000; offset += 1000) {
    const { data, error } = await db.from("jobs").select("id").eq("status", "published").order("id").range(offset, offset + 999);
    if (error) throw new Error("Unable to generate public job sitemap");
    for (const job of data || []) pages.push({ url: `${siteUrl}/jobs/${job.id}` });
    if (!data || data.length < 1000) break;
  }
  return pages;
}
