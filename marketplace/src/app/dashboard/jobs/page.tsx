import {archiveListing} from "@/app/dashboard/work/actions";
import Link from "next/link";
import { redirect } from "next/navigation";
import { closeJob } from "@/app/jobs/actions";
import { PortalShell } from "@/components/portal-shell";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };
const one = (value: string | string[] | undefined) => Array.isArray(value) ? value[0] ?? "" : value ?? "";
const date = (value: string) => new Date(value).toLocaleDateString("en-NP");

export default async function EmployerJobsPage({ searchParams }: Props) {
  const supabase = await createClient();
  if (!supabase) return <main className="dashboard"><div className="setup-alert">Connect the shared database to manage job posts.</div></main>;
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/employer/login");
  const { data: profile, error: profileError } = await supabase.from("profiles").select("role").eq("id", user.id).maybeSingle();
  if (profileError || !profile) return <main className="dashboard"><div className="form-alert" role="alert">We couldn’t load your employer account. Refresh the page and try again.</div></main>;
  if (profile?.role !== "employer") redirect("/dashboard?error=employer-only");
  const [{ data: jobs, error: jobsError }, params] = await Promise.all([
    supabase.from("jobs").select("id,title,status,category,location,work_type,created_at,archived_at").eq("employer_id", user.id).order("created_at", { ascending: false }),
    searchParams,
  ]);
  const {data:assignments,error:workError}=await supabase.from("job_assignments").select("job_id,state").eq("employer_id",user.id).neq("state","cancelled");
  const assignedJobs=new Set((assignments??[]).map(w=>w.job_id));
  const success = one(params.success);
  const error = one(params.error);

  return <PortalShell role="employer" activePath="/dashboard/jobs">
    <div className="eyebrow">Hiring workspace</div><div className="portal-toolbar"><div><h1>My job posts</h1><p style={{ color: "var(--muted)", fontSize: 13 }}>Manage listings and see when each role is ready for applicants.</p></div><Link className="button" href="/dashboard/jobs/new">Post a job →</Link></div>
    {success === "updated" && <div className="setup-alert">Your changes were saved. Updated published roles return to review.</div>}
    {success === "closed" && <div className="setup-alert">The job was closed and is no longer listed publicly.</div>}
    {success === "archived" && <div className="setup-alert">Removed from public listings. Applications and history are kept.</div>}{success === "restored" && <div className="setup-alert">Restored and sent for review before republication.</div>}
    {error && <div className="form-alert">We couldn’t complete that job update. Refresh the page and try again.</div>}
    {jobsError ? <div className="form-alert" role="alert">We couldn’t load your job posts. Refresh the page and try again.</div> : !jobs?.length ? <section className="dashboard-card"><h2 style={{ marginTop: 0 }}>No job posts yet</h2><p style={{ color: "var(--muted)", fontSize: 13 }}>Create a clear role description and submit it for review.</p><Link className="button" href="/dashboard/jobs/new">Create your first job →</Link></section> :
      <div className="portal-table"><table><thead><tr><th>Role</th><th>Location</th><th>Work type</th><th>Status</th><th>Posted</th><th>Actions</th></tr></thead><tbody>
        {jobs.map((job) => <tr key={job.id}><td><strong>{job.title}</strong><small style={{ display: "block", marginTop: 4, color: "var(--muted)" }}>{job.category}</small></td><td>{job.location}</td><td>{job.work_type.replaceAll("_", " ")}</td><td><span className={`status-tag status-${job.status}`}>{job.archived_at?"Removed":job.status.replaceAll("_", " ")}</span></td><td>{date(job.created_at)}</td><td><div className="inline-form">{!workError&&!assignedJobs.has(job.id)&&!["closed"].includes(job.status)&&!job.archived_at&&<Link href={`/dashboard/jobs/${job.id}/edit`}>Edit post</Link>}<Link href="/dashboard/work">Work progress</Link><details><summary>{job.archived_at?"Restore post":"Remove post"}</summary><p>{job.archived_at?"Restore for admin review. Completed work cannot be reopened.":"Remove from listings while keeping application history. Active work must finish first, or cancel an unstarted assignment."}</p><form action={archiveListing}><input type="hidden" name="job_id" value={job.id}/>{job.archived_at&&<input type="hidden" name="restore" value="yes"/>}<button className="text-button">{job.archived_at?"Restore for review":"Confirm remove from listings"}</button></form></details>{job.status === "published" && !assignedJobs.has(job.id) && <form action={closeJob}><input type="hidden" name="job_id" value={job.id} /><button className="text-button" type="submit">Close</button></form>}</div></td></tr>)}
      </tbody></table></div>}
  </PortalShell>;
}
