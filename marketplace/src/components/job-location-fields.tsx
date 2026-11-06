"use client";
import { useState } from "react";
import type { RemoteTerms } from "@/lib/remote-job";

export function JobLocationFields({job}: {job?: Partial<RemoteTerms> & {work_mode: string; location: string}}) {
  const [mode, setMode] = useState(job?.work_mode || "onsite");
  const [scope, setScope] = useState(job?.remote_scope || "");
  return <>
    <label htmlFor="work_mode">Work arrangement</label>
    <select id="work_mode" name="work_mode" value={mode} onChange={e=>setMode(e.target.value)}>
      <option value="onsite">On site</option><option value="hybrid">Hybrid</option><option value="remote">Remote</option>
    </select>
    <label htmlFor="location">{mode === "remote" ? "Employer location (optional)" : "Work location"}</label>
    <input id="location" name="location" placeholder="City or country" maxLength={120} defaultValue={job?.location || ""}/>
    {mode === "remote" && <>
      <label htmlFor="remote_scope">Who can apply?</label>
      <select id="remote_scope" name="remote_scope" value={scope} required={!job || Boolean(job.remote_scope) || job.work_mode !== "remote"} onChange={e=>setScope(e.target.value)}>
        <option value="">{job?.work_mode === "remote" && !job.remote_scope ? "Previously unspecified" : "Choose applicant locations"}</option>
        <option value="worldwide">Applicants anywhere in the world</option>
        <option value="regions">Applicants in specific countries or regions</option>
      </select>
      {scope === "regions" && <><label htmlFor="eligible_regions">Eligible countries or regions</label>
        <input name="eligible_regions" id="eligible_regions" required maxLength={180} defaultValue={job?.eligible_regions || ""} placeholder="e.g. Nepal and India"/></>}
      <label htmlFor="required_timezone">Working hours or time zone (optional)</label>
      <input id="required_timezone" name="required_timezone" maxLength={80} defaultValue={job?.required_timezone || ""} placeholder="e.g. 09:00–13:00 Asia/Kathmandu"/>
    </>}
  </>;
}
