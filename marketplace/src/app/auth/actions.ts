"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

const allowedRoles = new Set(["freelancer", "employer"]);

export async function signUp(formData: FormData) {
  const fullName = String(formData.get("full_name") ?? "").trim();
  const companyName = String(formData.get("company_name") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");
  const role = String(formData.get("account_type") ?? "freelancer");

  if (!fullName || fullName.length > 80 || companyName.length > 120 || !email.includes("@") || password.length < 10 || !allowedRoles.has(role)) {
    redirect("/signup?error=invalid");
  }

  const supabase = await createClient();
  if (!supabase) redirect("/signup?error=setup");

  const requestHeaders = await headers();
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? requestHeaders.get("origin") ?? "http://localhost:3000";
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: { full_name: fullName, company_name: companyName, account_type: role },
      emailRedirectTo: `${siteUrl}/auth/callback?next=/dashboard`,
    },
  });

  if (error) redirect("/signup?error=signup");
  if (data.session) redirect("/dashboard");
  redirect("/signup?success=check-email");
}

export async function signIn(formData: FormData) {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");
  const requestedNext = String(formData.get("next") ?? "");
  const next = requestedNext.startsWith("/") && !requestedNext.startsWith("//") && !requestedNext.startsWith("/login") ? requestedNext : "/dashboard";
  if (!email.includes("@") || !password) redirect("/login?error=invalid");

  const supabase = await createClient();
  if (!supabase) redirect("/login?error=setup");

  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) redirect("/login?error=credentials");
  redirect(next);
}

export async function signOut() {
  const supabase = await createClient();
  if (supabase) await supabase.auth.signOut();
  redirect("/");
}
