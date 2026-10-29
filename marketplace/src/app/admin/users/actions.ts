"use server";

import { redirect } from "next/navigation";
import { requireAdminContext } from "@/lib/supabase/admin";

const usersPath = "/admin/users";
const roles = new Set(["freelancer", "employer", "admin"]);
const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const validEmail = (email: string) => email.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

function logAdminError(action: string, error: { code?: string; status?: number; message?: string }) {
  console.error(`Titonova admin ${action} failed`, { code: error.code, status: error.status });
}

export async function adminCreateAccount(formData: FormData) {
  const { serviceClient } = await requireAdminContext();
  if (!serviceClient) redirect(`${usersPath}?error=setup`);

  const fullName = String(formData.get("full_name") ?? "").trim();
  const companyName = String(formData.get("company_name") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");
  const role = String(formData.get("role") ?? "freelancer");
  if (!fullName || fullName.length > 80 || companyName.length > 120 || !validEmail(email) || password.length < 10 || password.length > 72 || !roles.has(role)) {
    redirect(`${usersPath}?error=invalid`);
  }

  const { data, error } = await serviceClient.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { full_name: fullName, company_name: companyName, account_type: role },
  });
  if (error || !data.user) {
    if (error) logAdminError("create account", error);
    redirect(`${usersPath}?error=create`);
  }

  const { error: profileError } = await serviceClient.from("profiles").upsert({
    id: data.user.id,
    full_name: fullName,
    company_name: companyName,
    role,
  }, { onConflict: "id" });

  if (profileError) {
    await serviceClient.auth.admin.deleteUser(data.user.id);
    console.error("Titonova admin create profile failed", { code: profileError.code });
    redirect(`${usersPath}?error=create`);
  }

  redirect(`${usersPath}?success=created`);
}

export async function adminUpdateAccount(formData: FormData) {
  const { user: adminUser, serviceClient } = await requireAdminContext();
  if (!serviceClient) redirect(`${usersPath}?error=setup`);

  const id = String(formData.get("user_id") ?? "");
  const fullName = String(formData.get("full_name") ?? "").trim();
  const companyName = String(formData.get("company_name") ?? "").trim();
  const headline = String(formData.get("headline") ?? "").trim();
  const bio = String(formData.get("bio") ?? "").trim();
  const location = String(formData.get("location") ?? "").trim();
  const skills = String(formData.get("skills") ?? "").split(/[\n,]/).map((skill) => skill.trim()).filter(Boolean);
  const portfolioUrl = String(formData.get("portfolio_url") ?? "").trim();
  const linkedinUrl = String(formData.get("linkedin_url") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");
  const role = String(formData.get("role") ?? "");
  const validUrl = (value: string) => {
    if (!value) return true;
    try {
      const parsed = new URL(value);
      return (parsed.protocol === "https:" || parsed.protocol === "http:") && value.length <= 300;
    } catch {
      return false;
    }
  };
  if (!uuidPattern.test(id) || !fullName || fullName.length > 80 || companyName.length > 120 || headline.length > 120 || bio.length > 3000 || location.length > 120 || skills.length > 20 || skills.some((skill) => skill.length > 50) || !validUrl(portfolioUrl) || !validUrl(linkedinUrl) || !validEmail(email) || !roles.has(role) || (password && (password.length < 10 || password.length > 72))) {
    redirect(`${usersPath}?error=invalid`);
  }
  if (id === adminUser.id && role !== "admin") redirect(`${usersPath}?error=self`);

  if (role !== "admin") {
    const { count, error: countError } = await serviceClient.from("profiles").select("id", { count: "exact", head: true }).eq("role", "admin");
    if (countError) {
      console.error("Titonova admin count failed", { code: countError.code });
      redirect(`${usersPath}?error=save`);
    }
    const { data: targetProfile } = await serviceClient.from("profiles").select("role").eq("id", id).maybeSingle();
    if (targetProfile?.role === "admin" && (count ?? 0) <= 1) redirect(`${usersPath}?error=last-admin`);
  }

  const { data: targetData, error: targetError } = await serviceClient.auth.admin.getUserById(id);
  if (targetError || !targetData.user) {
    if (targetError) logAdminError("find account", targetError);
    redirect(`${usersPath}?error=not-found`);
  }

  const { error: authError } = await serviceClient.auth.admin.updateUserById(id, {
    email,
    ...(password ? { password } : {}),
    user_metadata: {
      ...targetData.user.user_metadata,
      full_name: fullName,
      company_name: companyName,
      account_type: role,
    },
  });
  if (authError) {
    logAdminError("update account", authError);
    redirect(`${usersPath}?error=save`);
  }

  const { error: profileError } = await serviceClient.from("profiles").upsert({
    id,
    full_name: fullName,
    company_name: companyName,
    role,
    headline,
    bio,
    location,
    skills,
    portfolio_url: portfolioUrl,
    linkedin_url: linkedinUrl,
  }, { onConflict: "id" });
  if (profileError) {
    console.error("Titonova admin update profile failed", { code: profileError.code });
    redirect(`${usersPath}?error=partial`);
  }

  redirect(`${usersPath}?success=updated`);
}

export async function adminDeleteAccount(formData: FormData) {
  const { user: adminUser, serviceClient } = await requireAdminContext();
  if (!serviceClient) redirect(`${usersPath}?error=setup`);

  const id = String(formData.get("user_id") ?? "");
  const confirmation = String(formData.get("confirmation") ?? "");
  if (!uuidPattern.test(id) || confirmation !== "DELETE") redirect(`${usersPath}?error=confirm`);
  if (id === adminUser.id) redirect(`${usersPath}?error=self-delete`);

  const { data: targetProfile } = await serviceClient.from("profiles").select("role").eq("id", id).maybeSingle();
  if (targetProfile?.role === "admin") {
    const { count, error: countError } = await serviceClient.from("profiles").select("id", { count: "exact", head: true }).eq("role", "admin");
    if (countError) {
      console.error("Titonova admin count failed", { code: countError.code });
      redirect(`${usersPath}?error=delete`);
    }
    if ((count ?? 0) <= 1) redirect(`${usersPath}?error=last-admin`);
  }

  const { error } = await serviceClient.auth.admin.deleteUser(id);
  if (error) {
    logAdminError("delete account", error);
    redirect(`${usersPath}?error=delete`);
  }
  redirect(`${usersPath}?success=deleted`);
}
