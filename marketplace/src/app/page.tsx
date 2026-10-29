import Link from "next/link";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

const categories = [
  ["✳", "Design & creative", "Brand, visual and product design"],
  ["⌘", "Development", "Web, mobile and software"],
  ["◉", "Marketing", "Content, growth and community"],
  ["▤", "Writing & content", "Editorial, copy and translation"],
  ["▧", "Business support", "Operations, finance and admin"],
];

function formatPay(min: number | null, max: number | null, currency: string) {
  if (min === null && max === null) return "Pay discussed";
  const format = (value: number) => new Intl.NumberFormat("en-NP").format(value);
  return `${currency} ${min === null ? "—" : format(min)}–${max === null ? "—" : format(max)}`;
}

export default async function Home() {
  const supabase = await createClient();
  const result = supabase
    ? await supabase.from("jobs").select("id,title,category,location,work_type,currency,pay_min,pay_max,employer:profiles!jobs_employer_id_fkey(company_name,full_name)").eq("status", "published").order("created_at", { ascending: false }).limit(3)
    : null;
  const jobs = result?.data ?? [];
  const databaseReady = Boolean(supabase && !result?.error);

  return (
    <div className="page-shell">
      {!databaseReady && <div className="preview-bar"><strong>Early preview:</strong> Connect the secure marketplace database to enable accounts, applications, and live listings.</div>}
      <header className="site-header">
        <Link className="brand" href="/"><span className="brand-mark">↗</span> Titonova</Link>
        <nav className="nav-links" aria-label="Main navigation"><a href="#categories">Explore skills</a><Link href="/ne">नेपाली</Link><Link href="/jobs">Browse jobs</Link><a href="#how">How it works</a></nav>
        <div className="nav-actions"><Link className="text-button" href="/login">Job seeker login</Link><Link className="text-button employer-login-link" href="/employer/login">Employer sign in</Link><Link className="button" href="/signup">Join Titonova <span aria-hidden="true">→</span></Link></div>
      </header>

      <main>
        <section className="hero">
          <div>
            <div className="eyebrow">Nepal’s marketplace for independent work</div>
            <h1>Your skills deserve <em>a bigger stage.</em></h1>
            <p className="hero-copy">Find meaningful work, meet great people, and grow your career — all from right here in Nepal.</p>
            <div className="hero-actions"><Link className="button" href="/jobs">Explore opportunities <span aria-hidden="true">→</span></Link><Link className="button secondary" href="/signup?role=employer">I’m hiring</Link></div>
            <div className="hero-note"><span className="role-badge">Built for Nepal</span><span>Local talent. Clear opportunities. Better work.</span></div>
          </div>

          <div className="preview-card" aria-label="Latest published jobs">
            <div className="preview-head"><strong>Latest opportunities</strong><span className="status-pill">{jobs.length} open</span></div>
            <Link className="preview-search" href="/jobs">⌕ &nbsp;Search job title, skill or company</Link>
            {jobs.length ? jobs.map((job) => {
              const employer = Array.isArray(job.employer) ? job.employer[0] : job.employer;
              const company = employer?.company_name || employer?.full_name || "Nepal employer";
              return <Link className="sample-job" href={`/jobs/${job.id}`} key={job.id}>
                <div className="job-meta"><div className="company"><span className="company-mark">{company.slice(0, 1).toUpperCase()}</span><div><span className="company-name">{company}</span><span className="company-place">{job.location}</span></div></div><span className="job-pay">{formatPay(job.pay_min, job.pay_max, job.currency)}</span></div>
                <h3>{job.title}</h3><div className="tag-row"><span className="tag">{job.category}</span><span className="tag">{job.work_type.replaceAll("_", " ")}</span></div>
              </Link>;
            }) : <div className="empty-preview"><strong>New opportunities are on the way.</strong><p>Browse all listings or create an account to get started.</p><Link href="/jobs">Browse jobs →</Link></div>}
            <div className="preview-callout">Local talent, global potential<span>Good work starts here.</span></div>
          </div>
        </section>

        <section className="stats" aria-label="Marketplace focus">
          <div className="stats-inner"><span className="stats-label">Designed around how Nepal works</span><div className="stat"><span className="stat-icon">⌂</span><div><b>Nepal first</b><small>Local talent and employers</small></div></div><div className="stat"><span className="stat-icon">↔</span><div><b>Flexible work</b><small>Remote, contract and full time</small></div></div><div className="stat"><span className="stat-icon">✳</span><div><b>Skill led</b><small>Opportunities across disciplines</small></div></div></div>
        </section>

        <section className="content" id="categories">
          <div className="section-heading"><div><div className="eyebrow">Find your path</div><h2>Work that fits your skills</h2><p>Explore opportunities across Nepal’s most in-demand fields.</p></div><Link className="section-link" href="/dashboard/profile">Build your profile →</Link></div>
          <div className="category-row">{categories.map(([icon, name, description]) => <Link className="category" href={`/jobs?category=${encodeURIComponent(name)}`} key={name}><span className="category-icon" aria-hidden="true">{icon}</span><span>{name}<small>{description}</small></span></Link>)}</div>

          <div className="section-heading" id="jobs" style={{ marginTop: 46 }}><div><div className="eyebrow">Fresh opportunities</div><h2>Good work starts here</h2><p>Explore published roles from employers on Titonova.</p></div><Link className="section-link" href="/jobs">Browse all jobs →</Link></div>
          {jobs.length ? <div className="job-grid">{jobs.map((job) => {
            const employer = Array.isArray(job.employer) ? job.employer[0] : job.employer;
            const company = employer?.company_name || employer?.full_name || "Nepal employer";
            return <Link className="job-card" href={`/jobs/${job.id}`} key={job.id}>
              <div className="job-meta"><div className="company"><span className="company-mark">{company.slice(0, 1).toUpperCase()}</span><div><span className="company-name">{company}</span><span className="company-place">{job.location}</span></div></div><span className="badge">Open</span></div>
              <h3>{job.title}</h3><p className="desc">{job.category} · {job.work_type.replaceAll("_", " ")}</p>
              <div className="job-foot"><span>View details</span><strong>{formatPay(job.pay_min, job.pay_max, job.currency)}</strong></div>
            </Link>;
          })}</div> : <div className="empty-listing"><p>{databaseReady ? "There aren’t any published jobs yet. Check back soon." : "Job listings will appear here after the database is connected."}</p><Link className="button secondary" href="/jobs">Explore jobs</Link></div>}

          <div className="section-heading" id="how" style={{ marginTop: 52 }}><div><div className="eyebrow">Simple by design</div><h2>From profile to your next step</h2><p>A clear path to making a great connection.</p></div></div>
          <div className="steps"><div className="step"><div className="step-num">01</div><b>Build your profile</b><p>Share what you do, what you’re looking for, and the skills you bring.</p></div><div className="step"><div className="step-num">02</div><b>Find the right fit</b><p>Search opportunities by skill, location, and the way you want to work.</p></div><div className="step"><div className="step-num">03</div><b>Apply and follow along</b><p>Send an introduction and keep track of each application in your workspace.</p></div></div>
          <div className="banner"><div><h2>Hiring in Nepal? Find your people.</h2><p>Create an employer profile and get ready to meet local talent.</p></div><Link className="button" href="/signup?role=employer">Set up your employer profile <span aria-hidden="true">→</span></Link></div>
        </section>
      </main>
      <footer className="site-footer"><div>© 2026 Titonova Nepal</div><div className="footer-links"><a href="#how">How it works</a><Link href="/employer/login">Employer login</Link><Link href="/login">Member sign in</Link></div></footer>
    </div>
  );
}
