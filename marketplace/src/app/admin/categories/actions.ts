"use server";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireAdminContext } from "@/lib/supabase/admin";
export async function saveCategory(form: FormData) {
  const {sessionClient} = await requireAdminContext();
  const id = String(form.get("id") ?? "");
  const name = String(form.get("name") ?? "").trim().replace(/\s+/g, " ");
  const sortOrder = Number(form.get("sort_order"));
  if (name.length < 2 || name.length > 80 || !Number.isInteger(sortOrder) || sortOrder < 0 || sortOrder > 9999 || (id && !/^[0-9a-f-]{36}$/i.test(id))) redirect("/admin/categories?error=invalid");
  const values = {name, sort_order:sortOrder, active:form.get("active") === "on"};
  const result = id ? await sessionClient.from("job_categories").update(values).eq("id",id).select("id").single() : await sessionClient.from("job_categories").insert(values).select("id").single();
  if (result.error) redirect(`/admin/categories?error=${result.error.code === "23505" ? "duplicate" : "save"}`);
  for (const path of ["/", "/jobs", "/admin/categories", "/dashboard/jobs/new"]) revalidatePath(path);
  redirect("/admin/categories?success=saved");
}
