"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

const allowedRoles = new Set(["freelancer", "employer"]);

async function getEmailRedirect(next: string) {
  const requestHeaders = await headers();
  const configuredSiteUrl = process.env.NEXT_PUBLIC_SITE_URL?.trim();
  const requestOrigin = requestHeaders.get("origin");
  let siteOrigin = "http://localhost:3000";

  try {
    siteOrigin = new URL(configuredSiteUrl || requestOrigin || siteOrigin).origin;
  } catch {
    // Fall back to the local development URL if the environment setting is malformed.
  }

  const callbackUrl = new URL("/auth/callback", siteOrigin);
  callbackUrl.searchParams.set("next", next);
  return callbackUrl.toString();
}

function isRateLimit(error: { code?: string | null; status?: number }) {
  return error.code === "over_email_send_rate_limit" || error.code === "over_request_rate_limit" || error.status === 429;
}

export async function signUp(formData: FormData) {
  const fullName = String(formData.get("full_name") ?? "").trim();
  const companyName = String(formData.get("company_name") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");
  const role = String(formData.get("account_type") ?? "freelancer");
  const signupPath = role === "employer" ? "/signup?role=employer" : "/signup";

  if (!fullName || fullName.length > 80 || companyName.length > 120 || email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || password.length < 10 || !allowedRoles.has(role)) {
    redirect(`${signupPath}${signupPath.includes("?") ? "&" : "?"}error=invalid`);
  }

  const supabase = await createClient();
  if (!supabase) redirect(`${signupPath}${signupPath.includes("?") ? "&" : "?"}error=setup`);

  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: { full_name: fullName, company_name: companyName, account_type: role },
      emailRedirectTo: await getEmailRedirect("/dashboard"),
    },
  });

  if (error) {
    // Keep the public error message accurate without exposing provider details.
    // Supabase can reject signup for several reasons; do not label all of them
    // as duplicate email addresses.
    console.error("Titonova signup failed", { code: error.code, status: error.status });
    const errorType = error.code === "email_exists" || error.code === "user_already_exists"
      ? "exists"
      : error.code === "over_email_send_rate_limit" || error.code === "over_request_rate_limit"
        ? "rate-limit"
        : error.code === "weak_password"
          ? "weak-password"
          : error.code === "email_address_invalid"
            ? "email-invalid"
            : error.code === "signup_disabled" || error.code === "email_provider_disabled"
              ? "unavailable"
              : "try-again";
    redirect(`${signupPath}${signupPath.includes("?") ? "&" : "?"}error=${errorType}`);
  }
  if (data.session) redirect("/dashboard");
  redirect(`${signupPath}${signupPath.includes("?") ? "&" : "?"}success=check-email`);
}

export async function resendSignupConfirmation(formData: FormData) {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  if (!email || email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    redirect("/signup?error=email-invalid&resend=1");
  }

  const supabase = await createClient();
  if (!supabase) redirect("/signup?error=setup&resend=1");

  const { error } = await supabase.auth.resend({
    type: "signup",
    email,
    options: { emailRedirectTo: await getEmailRedirect("/dashboard") },
  });

  if (error) {
    console.error("Titonova confirmation resend failed", { code: error.code, status: error.status });
    if (isRateLimit(error)) redirect("/signup?error=rate-limit&resend=1");
    // Keep the response neutral so the page does not reveal whether an address has an account.
    redirect("/signup?success=resent");
  }

  redirect("/signup?success=resent");
}

export async function requestPasswordReset(formData: FormData) {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  if (!email || email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    redirect("/forgot-password?error=email-invalid");
  }

  const supabase = await createClient();
  if (!supabase) redirect("/forgot-password?error=setup");

  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: await getEmailRedirect("/reset-password"),
  });

  if (error) {
    console.error("Titonova password reset request failed", { code: error.code, status: error.status });
    if (isRateLimit(error)) redirect("/forgot-password?error=rate-limit");
  }

  // Use the same response whether the address exists or not.
  redirect("/forgot-password?sent=1");
}

export async function updatePassword(formData: FormData) {
  const password = String(formData.get("password") ?? "");
  const confirmPassword = String(formData.get("confirm_password") ?? "");
  if (password.length < 10 || password !== confirmPassword) {
    redirect(`/reset-password?error=${password.length < 10 ? "weak-password" : "mismatch"}`);
  }

  const supabase = await createClient();
  if (!supabase) redirect("/reset-password?error=setup");
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/reset-password?error=confirmation");
  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).maybeSingle();

  const { error } = await supabase.auth.updateUser({ password });
  if (error) {
    console.error("Titonova password update failed", { code: error.code, status: error.status });
    redirect(`/reset-password?error=${error.code === "weak_password" ? "weak-password" : "save"}`);
  }

  await supabase.auth.signOut();
  const loginPath = profile?.role === "admin" ? "/admin/login" : profile?.role === "employer" ? "/employer/login" : "/login";
  redirect(`${loginPath}?success=password-updated`);
}

export async function signIn(formData: FormData) {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");
  const expectedRole = String(formData.get("expected_role") ?? "freelancer");
  const requestedNext = String(formData.get("next") ?? "");
  let next = "/dashboard";
  try {
    const localOrigin = "https://titonova.invalid";
    const target = new URL(requestedNext || next, localOrigin);
    const isAuthRoute = /^\/(?:login|employer\/login|admin\/login|signup|forgot-password|reset-password|auth\/callback)(?:\/|$)/.test(target.pathname);
    if (target.origin === localOrigin && !isAuthRoute) next = `${target.pathname}${target.search}${target.hash}`;
  } catch {
    // Use the role-aware workspace when the return path is malformed.
  }
  const loginPath = expectedRole === "admin" ? "/admin/login" : expectedRole === "employer" ? "/employer/login" : "/login";
  if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || !password || !["freelancer", "employer", "admin"].includes(expectedRole)) redirect(`${loginPath}?error=invalid`);

  const supabase = await createClient();
  if (!supabase) redirect(`${loginPath}?error=setup`);

  const { data: signInData, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) redirect(`${loginPath}?error=${error.code === "email_not_confirmed" ? "confirmation" : "credentials"}`);
  const user = signInData.user;
  if (!user) {
    await supabase.auth.signOut();
    redirect(`${loginPath}?error=credentials`);
  }

  const { data: profile, error: profileError } = await supabase.from("profiles").select("role").eq("id", user.id).maybeSingle();
  if (profileError || !profile) {
    await supabase.auth.signOut();
    redirect(`${loginPath}?error=profile`);
  }

  if (profile.role !== expectedRole) {
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
