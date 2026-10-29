"use server";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export async function sendMessage(form: FormData) {
  const id = String(form.get("application_id") || "");
  if (!uuid.test(id)) redirect("/dashboard/applications");
  const path = `/dashboard/applications/${id}`;
  const body = String(form.get("body") || "").trim();
  if (!body || body.length > 3000) redirect(`${path}?chat=invalid#conversation`);
  const db = await createClient();
  if (!db) redirect(`${path}?chat=error#conversation`);
  const { data: { user } } = await db.auth.getUser();
  if (!user) redirect("/login");
  const { error } = await db.from("application_messages").insert({ application_id: id, sender_id: user.id, body });
  if (error) redirect(`${path}?chat=${error.message.includes("wait a minute") ? "rate" : "error"}#conversation`);
  revalidatePath(path);
  redirect(`${path}?chat=sent#conversation`);
}
export async function reportMessage(form: FormData) {
  const id = String(form.get("application_id") || "");
  const message = String(form.get("message_id") || "");
  const reason = String(form.get("reason") || "");
  const details = String(form.get("details") || "").trim();
  if (!uuid.test(id) || !uuid.test(message)) redirect("/dashboard/applications");
  const path = `/dashboard/applications/${id}`;
  if (!["spam","harassment","suspicious","other"].includes(reason) || details.length>1500) redirect(`${path}?chat=invalid#conversation`);
  const db = await createClient();
  if (!db) redirect(`${path}?chat=error#conversation`);
  const { data: { user } } = await db.auth.getUser();
  if (!user) redirect("/login");
  const { data: target } = await db.from("application_messages").select("id").eq("id",message).eq("application_id",id).maybeSingle();
  if (!target) redirect(`${path}?chat=error#conversation`);
  const { error } = await db.from("message_reports").insert({message_id:message,reporter_id:user.id,reason,details});
  redirect(`${path}?chat=${error?.code === "23505" ? "reported" : error ? "error" : "reported"}#conversation`);
}
