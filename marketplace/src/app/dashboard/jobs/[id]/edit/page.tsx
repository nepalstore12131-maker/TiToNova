import {getJobCategories} from "@/lib/job-categories";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { updateJob } from "@/app/jobs/actions";
import { PortalShell } from "@/components/portal-shell";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ id: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> };


export default async function EditJobPage({ params, searchParams }: Props) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const supabase = await createClient();
  if (!supabase) return <main className="dashboard"><div className="setup-alert">Connect the shared database to edit job posts.</div></main>;
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/employer/login");
  const { data: profile } = await supabase.from("profiles").select("role,employer_premium_until").eq("id", user.id).maybeSingle();
  if (profile?.role !== "employer") redirect("/dashboard?error=employer-only");
  if (!profile.employer_premium_until || new Date(profile.employer_premium_until).getTime() <= Date.now()) redirect("/dashboard/billing?required=1");
  const categories = await getJobCategories(supabase);
  const { data: job } = await supabase.from("jobs").select("id,title,description,category,location,work_type,pay_period,work_mode,experience_level,pay_min,pay_max,status").eq("id", id).eq("employer_id", user.id).maybeSingle();
  if (!job || job.status === "closed") notFound();
  const {data:assignment,error:workError}=await supabase.from("job_assignments").select("id").eq("job_id",id).neq("state","cancelled").maybeSingle();
  if(workError||assignment)redirect("/dashboard/work");
  const paramsValue = await searchParams;
  const error = Array.isArray(paramsValue.error) ? paramsValue.error[0] : paramsValue.error;

  return <PortalShell role="employer" activePath="/dashboard/jobs">
    <p style={{ margin: "0 0 18px", fontSize: 12 }}><Link href="/dashboard/jobs" style={{ color: "var(--green)" }}>← My job posts</Link></p>
    <div className="eyebrow">Edit listing</div><h1>{job.title}</h1>
    {job.status === "published" && <div className="setup-alert" style={{ marginTop: 16 }}>Saving changes will temporarily remove this listing from search while an administrator reviews the update.</div>}
    {error && <div className="form-alert">Check the details and try again.</div>}
    <section className="dashboard-card"><form action={updateJob} className="auth-form"><input type="hidden" name="job_id" value={job.id} />
      <label htmlFor="title">Job title</label><input id="title" name="title" defaultValue={job.title} minLength={4} maxLength={120} required />
      <label htmlFor="category">Category</label><select id="category" name="category" defaultValue={job.category} required>{!categories.includes(job.category) && <option>{job.category}</option>}{categories.map((category) => <option key={category}>{category}</option>)}</select>
      <label htmlFor="location">Location</label><input id="location" name="location" defaultValue={job.location} maxLength={120} />
      <label htmlFor="work_type">Work type</label><select id="work_type" name="work_type" defaultValue={job.work_type}><option value="full_time">Full time</option><option value="part_time">Part time</option><option value="contract">Contract</option><option value="freelance">Freelance</option></select>
      <label htmlFor="work_mode">Work arrangement</label><select id="work_mode" name="work_mode" defaultValue={job.work_mode}><option value="onsite">On site</option><option value="hybrid">Hybrid</option><option value="remote">Remote</option></select><label htmlFor="experience_level">Experience level</label><select id="experience_level" name="experience_level" defaultValue={job.experience_level}><option value="any">Any experience</option><option value="entry">Entry level</option><option value="mid">Mid level</option><option value="senior">Senior level</option></select>
<label htmlFor="pay_period">Pay period</label><select id="pay_period" name="pay_period" defaultValue={job.pay_period}><option value="month">Per month</option><option value="hour">Per hour</option><option value="project">Per project</option><option value="unspecified">To discuss</option></select><div className="pay-fields"><div><label htmlFor="pay_min">Minimum pay (NPR)</label><input id="pay_min" name="pay_min" type="number" min="0" step="1" defaultValue={job.pay_min ?? ""} /></div><div><label htmlFor="pay_max">Maximum pay (NPR)</label><input id="pay_max" name="pay_max" type="number" min="0" step="1" defaultValue={job.pay_max ?? ""} /></div></div>
      <label htmlFor="description">Role description</label><textarea className="cover-note" id="description" name="description" minLength={30} maxLength={12000} defaultValue={job.description} required />
      <button className="button full" type="submit">Save changes →</button>
    </form></section>
  </PortalShell>;
}
