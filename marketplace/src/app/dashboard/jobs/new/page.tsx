import {Money} from "@/components/currency-display";
import {nextPostSource, type PostAllowance} from "@/lib/posting-plan";
import { JobLocationFields } from "@/components/job-location-fields";
import {WorkerCountField} from '@/components/worker-count-field';
import {ApplicationWindowFields} from "@/components/application-window";
import {SampleHelp} from "@/components/sample-links";
import {randomUUID} from "node:crypto";
import {AccountSubmit} from "@/components/account-form-controls";
import {getJobCategories} from "@/lib/job-categories";
import { redirect } from "next/navigation";
import Link from "next/link";
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
  const { data: profile, error: profileError } = await supabase.from("profiles").select("role,employer_premium_until").eq("id", user.id).maybeSingle();
  if (profileError || !profile) return <main className="dashboard"><div className="form-alert" role="alert">We couldn’t load your employer account. Refresh the page and try again.</div></main>;
  if (profile?.role !== "employer") redirect("/dashboard?error=employer-only");
  const {data: allowance,error: allowanceError}=await supabase.rpc("post_allowance").single();
  const source=nextPostSource(allowance as PostAllowance | null);
  if (!source) return <PortalShell role="employer" activePath="/dashboard/jobs/new">
    <h1>{allowanceError?"Posting allowance unavailable":"Choose how to post"}</h1>
    <p>{allowanceError?"Please try again shortly.":"Your account has no remaining posts. See the price before choosing a single post or Premium."}</p>
    <Link className="button" href="/dashboard/billing">View posting options</Link></PortalShell>;
  const categories = await getJobCategories(supabase);
  const params = await searchParams;
  const error = Array.isArray(params.error) ? params.error[0] : params.error;

  return <PortalShell role="employer" activePath="/dashboard/jobs/new">
    <main className="auth-wrap"><section className="auth-card" style={{ width: "min(620px, 100%)" }}>
      <div className="eyebrow">Employer workspace</div><h1>Post a job</h1><p>Posting with {source}. Due now: <Money amount={0}/>.</p><p className="auth-copy">Describe the work, choose the pay and publish. Hiring for your home or business is welcome.</p>
      {error === "invalid" && <div className="form-alert">Check the role details and pay range, then try again.</div>}
      {error === "save" && <div className="form-alert">We couldn’t save your listing. Please try again.</div>}
      <form action={createJob} className="auth-form"><input type="hidden" name="submission_key" value={randomUUID()}/>
        <label htmlFor="title">Job title</label><input id="title" name="title" minLength={4} maxLength={120} required placeholder="e.g. Home cleaning help or café waiter" />
        <label htmlFor="category">Category</label><select id="category" name="category" required><option value="">Choose a category</option>{categories.map(category=><option key={category}>{category}</option>)}</select>

        <WorkerCountField/><label htmlFor="work_type">Work type</label><select id="work_type" name="work_type" defaultValue="contract"><option value="full_time">Full time</option><option value="part_time">Part time</option><option value="contract">Contract</option><option value="freelance">Freelance</option></select>
        <JobLocationFields /><label htmlFor="experience_level">Experience level</label><select id="experience_level" name="experience_level" defaultValue="any"><option value="any">Any experience</option><option value="entry">Entry level</option><option value="mid">Mid level</option><option value="senior">Senior level</option></select>
<label htmlFor="currency">Advertised pay currency</label><select name="currency" id="currency" defaultValue={"NPR"}><option value="NPR">NPR · Nepalese rupees</option><option value="USD">USD · US dollars</option></select><label htmlFor="pay_period">Pay period</label><select id="pay_period" name="pay_period" defaultValue="month"><option value="month">Per month</option><option value="hour">Per hour</option><option value="project">Per project</option><option value="unspecified">To discuss</option></select><div className="pay-fields"><div><label htmlFor="pay_min">Minimum pay</label><input id="pay_min" name="pay_min" type="number" min="0" step="1" placeholder="Optional" /></div><div><label htmlFor="pay_max">Maximum pay</label><input id="pay_max" name="pay_max" type="number" min="0" step="1" placeholder="Optional" /></div></div>
        <label htmlFor="description">Work description</label><textarea className="cover-note" id="description" name="description" minLength={30} maxLength={12000} required placeholder="Describe the tasks, approximate location, dates, hours, pay and skills needed. For a one-day task, choose Contract and Per project. Do not include your private home address." />
        <details><summary>Application dates & urgency · optional</summary><ApplicationWindowFields/></details><details><summary>Examples of the work · optional</summary><label htmlFor="reference_links">Example of the work you want (optional)</label><textarea id="reference_links" name="reference_links" rows={3} maxLength={3000} placeholder="Google Drive or YouTube video links"/><SampleHelp/><small>These examples will be public when your job is published. Do not include confidential files or private addresses. Candidates do not have to provide a demo to apply.</small></details>
        <label htmlFor="job_photos">Job photos (optional, up to 4)</label>
        <input id="job_photos" type="file" name="job_photos" accept="image/jpeg,image/png,image/webp" multiple/>
        <small>Choose up to four JPG, PNG or WebP images, maximum 3 MB each. Photos will appear publicly after the job is approved. Avoid private addresses or personal information.</small>
        <AccountSubmit pendingLabel="Posting…">Post job →</AccountSubmit>
      </form>
    </section></main>
  </PortalShell>;
}
