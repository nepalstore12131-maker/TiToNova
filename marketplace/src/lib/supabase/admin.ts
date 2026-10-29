import "server-only";

import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { redirect } from "next/navigation";
import { createClient as createSessionClient } from "@/lib/supabase/server";

export async function requireAdminContext() {
  const sessionClient = await createSessionClient();
  if (!sessionClient) redirect("/admin/login?error=setup");

  const { data: { user }, error: userError } = await sessionClient.auth.getUser();
  if (userError || !user) redirect("/admin/login");

  const { data: profile, error: profileError } = await sessionClient
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();

  if (profileError || profile?.role !== "admin") redirect("/dashboard?error=admin-only");

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const serviceClient = url && serviceKey
    ? createSupabaseClient(url, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } })
    : null;

  return { user, sessionClient, serviceClient };
}
