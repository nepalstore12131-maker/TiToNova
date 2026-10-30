import {Reputation} from '@/components/reputation';
import { ProfileAvatar } from "@/components/profile-avatar";
import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
type Company = {company_name:string;full_name:string;headline:string;bio:string;location:string;portfolio_url:string;employer_verified:boolean};
export const dynamic = "force-dynamic";
export default async function CompanyPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{lang?:string}> }) {
  const { id } = await params;
  const ne=(await searchParams).lang==="ne";
  const t=(en:string,np:string)=>ne?np:en;
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) notFound();
  const db = await createClient();
  if (!db) return <main className="content"><p>Company profiles are temporarily unavailable.</p></main>;
  const { data: company, error } = await db.rpc("public_company", {p_id:id}).returns<Company[]>().maybeSingle();
  if (error) return <main className="content"><p>We couldn’t load this company. Please try again.</p></main>;
  if (!company) notFound();
  const { data: jobs, error: jobsError } = await db.from("jobs").select("id,title,location,work_type").eq("employer_id", id).eq("status", "published").order("created_at", { ascending: false });
  const website = /^https?:\/\//i.test(company.portfolio_url || "") ? company.portfolio_url : null;
  return <div className="page-shell" lang={ne?"ne":"en"}><header className="site-header"><Link className="brand" href="/">↗ Titonova</Link><Link href="/jobs">{t("Browse jobs","रोजगारी खोज्नुहोस्")}</Link></header><main className="content"><section className="company-hero dashboard-card"><ProfileAvatar id={id} name={company.company_name||company.full_name} size={84}/><div className="eyebrow">{t("Company profile","कम्पनी प्रोफाइल")}</div><h1>{company.company_name || company.full_name}</h1>{company.employer_verified && <span className="verified-badge">✓ Titonova reviewed</span>}<p>{company.headline}</p><p>{company.location}</p><p style={{ whiteSpace: "pre-wrap" }}>{company.bio || "This company hasn’t added an introduction yet."}</p>{website && <a href={website} target="_blank" rel="noopener noreferrer">Visit company website ↗</a>}</section><Reputation id={id}/><h2>{t("Open roles","खुला पदहरू")}</h2>{jobsError ? <p>Roles could not be loaded. Please refresh.</p> : !jobs?.length ? <p>{t("No open roles at the moment.","अहिले कुनै खुला पद छैन।")}</p> : <div className="job-grid">{jobs.map(job => <article className="job-card" key={job.id}><h3><Link href={`/jobs/${job.id}`}>{job.title}</Link></h3><p>{job.location} · {job.work_type.replaceAll("_", " ")}</p></article>)}</div>}</main></div>;
}
