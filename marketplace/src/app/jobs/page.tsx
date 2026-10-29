import Link from "next/link";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };
const one = (value: string | string[] | undefined) => Array.isArray(value) ? value[0] ?? "" : value ?? "";
const money = (min: number | null, max: number | null, currency: string) => {
  if (min === null && max === null) return "Pay discussed";
  const format = (n: number) => new Intl.NumberFormat("en-NP").format(n);
  return `${currency} ${min === null ? "—" : format(min)}–${max === null ? "—" : format(max)}`;
};

export default async function JobsPage({ searchParams }: Props) {
  const params = await searchParams;
  const q = one(params.q).trim().slice(0, 100);
  const category = one(params.category).trim().slice(0, 80);
  const location = one(params.location).trim().slice(0, 100);
  const workType = one(params.work_type);
  const supabase = await createClient();
  let jobs: any[] = [];
  let loadFailed = false;

  if (supabase) {
    let query = supabase.from("jobs").select("id,title,description,category,location,work_type,currency,pay_min,pay_max,created_at,employer:profiles!jobs_employer_id_fkey(full_name,company_name)").eq("status", "published").order("created_at", { ascending: false }).limit(60);
    if (q) query = query.ilike("title", `%${q.replace(/[%_]/g, "\\$&")}%`);
    if (category) query = query.eq("category", category);
    if (location) query = query.ilike("location", `%${location.replace(/[%_]/g, "\\$&")}%`);
    if (["full_time", "part_time", "contract", "freelance"].includes(workType)) query = query.eq("work_type", workType);
    const result = await query;
    if (result.error) loadFailed = true;
    else jobs = result.data ?? [];
  }

  return <div className="page-shell">
    <header className="site-header"><Link className="brand" href="/"><span className="brand-mark">↗</span> Titonova</Link><nav className="nav-links"><Link href="/">Home</Link><Link href="/dashboard">Dashboard</Link></nav><div className="nav-actions"><Link className="text-button" href="/login">Log in</Link><Link className="button" href="/signup?role=employer">Post a job →</Link></div></header>
    <main className="content">
      <div className="section-heading"><div><div className="eyebrow">Find your next opportunity</div><h1 style={{ margin: "8px 0", fontSize: 38, letterSpacing: "-.055em" }}>Jobs in Nepal</h1><p>Search published roles from employers on Titonova.</p></div></div>
      <form className="finder" action="/jobs" method="get">
        <div className="field"><span aria-hidden="true">⌕</span><input type="search" name="q" defaultValue={q} placeholder="Job title or keyword" aria-label="Job title or keyword" /></div>
        <div className="field"><span aria-hidden="true">⌖</span><input type="search" name="location" defaultValue={location} placeholder="Location or remote" aria-label="Location" /></div>
        <div className="field"><span aria-hidden="true">▦</span><select name="category" defaultValue={category} aria-label="Category"><option value="">All categories</option><option>Design &amp; creative</option><option>Development</option><option>Marketing</option><option>Writing &amp; content</option><option>Business support</option><option>Other</option></select></div>
        <div className="field"><span aria-hidden="true">↔</span><select name="work_type" defaultValue={workType} aria-label="Work type"><option value="">All work types</option><option value="full_time">Full time</option><option value="part_time">Part time</option><option value="contract">Contract</option><option value="freelance">Freelance</option></select></div>
        <button className="button" type="submit">Search jobs</button>
      </form>
      {category && <p style={{ color: "var(--muted)", fontSize: 12, margin: "15px 2px" }}>Category: <strong>{category}</strong> · <Link href="/jobs" style={{ color: "var(--green)" }}>Clear</Link></p>}
      {!supabase && <div className="setup-alert" role="status" style={{ marginTop: 20 }}>Job search is temporarily unavailable while the shared database is being connected.</div>}
      {loadFailed && <div className="form-alert" role="alert" style={{ marginTop: 20 }}>We couldn’t load job listings. Refresh the page and try again.</div>}
      {supabase && !loadFailed && jobs.length === 0 && <div className="dashboard-card" style={{ marginTop: 20 }}><h2 style={{ marginTop: 0, fontSize: 18 }}>No published jobs match yet</h2><p style={{ color: "var(--muted)", fontSize: 13 }}>Try another search or check back as employers join.</p><Link className="button secondary" href="/signup?role=employer">Post the first opportunity →</Link></div>}
      <div className="job-grid" style={{ marginTop: 20 }}>{jobs.map((job) => {
        const employer = Array.isArray(job.employer) ? job.employer[0] : job.employer;
        const company = employer?.company_name || employer?.full_name || "Titonova employer";
        return <article className="job-card" key={job.id}>
          <div className="job-meta"><div className="company"><span className="company-mark">{company.slice(0, 1).toUpperCase()}</span><div><span className="company-name">{company}</span><span className="company-place">{job.location}</span></div></div><span className="badge">Published</span></div>
          <h2 style={{ margin: "0 0 8px", fontSize: 15 }}><Link href={`/jobs/${job.id}`}>{job.title}</Link></h2>
          <p className="desc">{job.description.slice(0, 150)}{job.description.length > 150 ? "…" : ""}</p>
          <div className="tag-row"><span className="tag">{job.category}</span><span className="tag">{job.work_type.replaceAll("_", " ")}</span></div>
          <div className="job-foot"><span>{new Date(job.created_at).toLocaleDateString("en-NP")}</span><strong>{money(job.pay_min, job.pay_max, job.currency)}</strong></div>
        </article>;
      })}</div>
    </main>
    <footer className="site-footer"><div>© 2026 Titonova Nepal</div><div className="footer-links"><Link href="/">Home</Link><Link href="/signup">Join</Link></div></footer>
  </div>;
}
