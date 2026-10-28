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
  const signupPath = role === "employer" ? "/signup?role=employer" : "/signup";

  if (!fullName || fullName.length > 80 || companyName.length > 120 || !email.includes("@") || password.length < 10 || !allowedRoles.has(role)) {
    redirect(`${signupPath}${signupPath.includes("?") ? "&" : "?"}error=invalid`);
  }

  const supabase = await createClient();
  if (!supabase) redirect(`${signupPath}${signupPath.includes("?") ? "&" : "?"}error=setup`);

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

  if (error) redirect(`${signupPath}${signupPath.includes("?") ? "&" : "?"}error=signup`);
  if (data.session) redirect("/dashboard");
  redirect(`${signupPath}${signupPath.includes("?") ? "&" : "?"}success=check-email`);
}

export async function signIn(formData: FormData) {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");
  const expectedRole = String(formData.get("expected_role") ?? "freelancer");
  const requestedNext = String(formData.get("next") ?? "");
  const next = requestedNext.startsWith("/") && !requestedNext.startsWith("//") && !requestedNext.startsWith("/login") ? requestedNext : "/dashboard";
  const loginPath = expectedRole === "admin" ? "/admin/login" : expectedRole === "employer" ? "/employer/login" : "/login";
  if (!email.includes("@") || !password || !["freelancer", "employer", "admin"].includes(expectedRole)) redirect(`${loginPath}?error=invalid`);

  const supabase = await createClient();
  if (!supabase) redirect(`${loginPath}?error=setup`);

  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) redirect(`${loginPath}?error=credentials`);
  const { data: { user } } = await supabase.auth.getUser();
  const { data: profile } = user ? await supabase.from("profiles").select("role").eq("id", user.id).maybeSingle() : { data: null };
  if (!user || profile?.role !== expectedRole) {
    await supabase.auth.signOut();
    redirect(`${loginPath}?error=role`);
  }
  redirect(next);
}

export async function signOut() {
  const supabase = await createClient();
  if (supabase) await supabase.auth.signOut();
  redirect("/");
}
