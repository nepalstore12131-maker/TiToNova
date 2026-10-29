import { redirect } from "next/navigation";
import { createJob } from "@/app/jobs/actions";
import { PortalShell } from "@/components/portal-shell";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };

export default async function NewJobPage({ searchParams }: Props) {
  const supabase = await createClient();
  if (!supabase) return <main className="dashboard"><div className="setup-alert">Connect the shared database to post a job.</div></main>;
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const { data: profile, error: profileError } = await supabase.from("profiles").select("role").eq("id", user.id).maybeSingle();
  if (profileError || !profile) return <main className="dashboard"><div className="form-alert" role="alert">We couldn’t load your employer account. Refresh the page and try again.</div></main>;
  if (profile?.role !== "employer") redirect("/dashboard?error=employer-only");
  const params = await searchParams;
  const error = Array.isArray(params.error) ? params.error[0] : params.error;

  return <PortalShell role="employer" activePath="/dashboard/jobs/new">
    <main className="auth-wrap"><section className="auth-card" style={{ width: "min(620px, 100%)" }}>
      <div className="eyebrow">Employer workspace</div><h1>Post a job</h1><p className="auth-copy">Submit a clear role description. New posts go to administrator review before they appear publicly.</p>
      {error === "invalid" && <div className="form-alert">Check the role details and pay range, then try again.</div>}
      {error === "save" && <div className="form-alert">We couldn’t save your listing. Please try again.</div>}
      <form action={createJob} className="auth-form">
        <label htmlFor="title">Job title</label><input id="title" name="title" minLength={4} maxLength={120} required placeholder="e.g. Product designer" />
        <label htmlFor="category">Category</label><select id="category" name="category" required><option value="">Choose a category</option><option>Design & creative</option><option>Development</option><option>Marketing</option><option>Writing & content</option><option>Business support</option><option>Other</option></select>
        <label htmlFor="location">Location</label><input id="location" name="location" maxLength={120} placeholder="Kathmandu, Pokhara, or Remote" />
        <label htmlFor="work_type">Work type</label><select id="work_type" name="work_type" defaultValue="contract"><option value="full_time">Full time</option><option value="part_time">Part time</option><option value="contract">Contract</option><option value="freelance">Freelance</option></select>
        <div className="pay-fields"><div><label htmlFor="pay_min">Minimum monthly pay (NPR)</label><input id="pay_min" name="pay_min" type="number" min="0" step="1" placeholder="Optional" /></div><div><label htmlFor="pay_max">Maximum monthly pay (NPR)</label><input id="pay_max" name="pay_max" type="number" min="0" step="1" placeholder="Optional" /></div></div>
        <label htmlFor="description">Role description</label><textarea className="cover-note" id="description" name="description" minLength={30} maxLength={12000} required placeholder="Describe the work, key responsibilities, and the skills you’re looking for…" />
        <button className="button full" type="submit">Submit for review →</button>
      </form>
    </section></main>
  </PortalShell>;
}
