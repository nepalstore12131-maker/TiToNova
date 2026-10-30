import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
export const starterCategories = ["Home & cleaning", "Hotels & restaurants", "Shops & retail", "Repairs & maintenance", "Events & temporary help", "Design & creative", "Development", "Marketing", "Writing & content", "Business support", "Other"];
export async function getJobCategories(db: SupabaseClient | null) {
  if (!db) return [...starterCategories];
  const {data, error} = await db.from("job_categories").select("name").eq("active",true).order("sort_order").order("name");
  return error ? [...starterCategories] : (data ?? []).map(row => row.name as string);
}
