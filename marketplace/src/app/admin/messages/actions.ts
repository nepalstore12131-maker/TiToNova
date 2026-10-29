"use server";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireAdminContext } from "@/lib/supabase/admin";
export async function moderateMessage(form: FormData) {
  const { sessionClient: db, user } = await requireAdminContext();
  const reportId=String(form.get("report_id")||"");
  const action=String(form.get("action")||"");
  if (!/^[0-9a-f-]{36}$/i.test(reportId) || !["hide","restore","pause","resume","resolved","dismissed"].includes(action)) redirect("/admin/messages?error=invalid");
  const {data: report}=await db.from("message_reports").select("message_id,message:application_messages(application_id)").eq("id",reportId).maybeSingle();
  if (!report) redirect("/admin/messages?error=unavailable");
  const message=Array.isArray(report.message)?report.message[0]:report.message;
  let error;
  if (action==="hide" || action==="restore") ({error}=await db.from("application_messages").update({hidden:action==="hide"}).eq("id",report.message_id));
  else if (action==="pause" || action==="resume") {
    if(!message) redirect("/admin/messages?error=unavailable");
    ({error}=await db.from("conversation_controls").upsert({application_id:message.application_id,paused:action==="pause",updated_by:user.id,updated_at:new Date().toISOString()}));
  } else ({error}=await db.from("message_reports").update({status:action}).eq("id",reportId));
  revalidatePath("/admin/messages");
  redirect(`/admin/messages?${error?"error=save":"success=saved"}`);
}
