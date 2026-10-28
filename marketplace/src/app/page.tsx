import Link from "next/link";

const categories = [
  ["✳", "Design & creative", "Brand, visual and product design"],
  ["⌘", "Development", "Web, mobile and software"],
  ["◉", "Marketing", "Content, growth and community"],
  ["▤", "Writing & content", "Editorial, copy and translation"],
  ["▧", "Business support", "Operations, finance and admin"],
];

const examples = [
  { initials: "S", company: "Sample Design Studio", city: "Kathmandu · Hybrid", title: "Graphic designer for a growing local brand", category: "Design", pay: "NPR 45k–65k / mo", type: "Full time" },
  { initials: "P", company: "Sample Product Team", city: "Pokhara · Remote", title: "Frontend developer — React and Next.js", category: "Development", pay: "NPR 80k–120k / mo", type: "Contract" },
  { initials: "M", company: "Sample Startup", city: "Kathmandu · On site", title: "Social media and content associate", category: "Marketing", pay: "NPR 35k–50k / mo", type: "Full time" },
];

export default function Home() {
  return (
    <div className="page-shell">
      <div className="preview-bar"><strong>Early preview:</strong> These are sample roles. Accounts, applications and payments are being built in stages.</div>
      <header className="site-header">
        <Link className="brand" href="/"><span className="brand-mark">↗</span> Titonova</Link>
        <nav className="nav-links" aria-label="Main navigation">
          <a href="#categories">Explore skills</a><Link href="/jobs">Browse work</Link><a href="#how">How it works</a>
        </nav>
        <div className="nav-actions"><Link className="text-button" href="/login">Log in</Link><Link className="button" href="/signup">Join Titonova <span aria-hidden="true">→</span></Link></div>
      </header>

      <main>
        <section className="hero">
          <div>
            <div className="eyebrow">Nepal’s marketplace for independent work</div>
            <h1>Your skills deserve <em>a bigger stage.</em></h1>
            <p className="hero-copy">Find meaningful work, meet great people, and grow your career — all from right here in Nepal.</p>
            <div className="hero-actions"><Link className="button" href="/signup?role=freelancer">Find your next opportunity <span aria-hidden="true">→</span></Link><Link className="button secondary" href="/signup?role=employer">I’m hiring</Link></div>
            <div className="hero-note"><div className="avatars" aria-hidden="true"><span className="avatar">S</span><span className="avatar">A</span><span className="avatar">R</span><span className="avatar">M</span></div><span>Designed for Nepal’s next generation of talent</span></div>
          </div>

          <div className="preview-card" aria-label="Example job listings">
            <div className="preview-head"><strong>Marketplace preview</strong><span className="status-pill">Sample roles</span></div>
            <div className="preview-search">⌕ &nbsp;Search job title, skill or company</div>
            {examples.map((job) => <article className="sample-job" key={job.title}>
              <div className="job-meta"><div className="company"><span className="company-mark">{job.initials}</span><div><span className="company-name">{job.company}</span><span className="company-place">{job.city}</span></div></div><span className="job-pay">{job.pay}</span></div>
              <h3>{job.title}</h3><div className="tag-row"><span className="tag">{job.category}</span><span className="tag">{job.type}</span></div>
            </article>)}
            <div className="preview-callout">Local talent, global potential<span>Good work starts here.</span></div>
          </div>
        </section>

        <section className="stats" aria-label="Marketplace focus">
          <div className="stats-inner"><span className="stats-label">Designed around how Nepal works</span><div className="stat"><span className="stat-icon">⌂</span><div><b>Nepal first</b><small>Local talent and employers</small></div></div><div className="stat"><span className="stat-icon">↔</span><div><b>Flexible work</b><small>Remote, contract and full time</small></div></div><div className="stat"><span className="stat-icon">✳</span><div><b>Skill led</b><small>Opportunities across disciplines</small></div></div></div>
        </section>

        <section className="content" id="categories">
          <div className="section-heading"><div><div className="eyebrow">Find your path</div><h2>Work that fits your skills</h2><p>Explore opportunities across Nepal’s most in demand fields.</p></div><Link className="section-link" href="/signup?role=freelancer">Create a profile →</Link></div>
          <div className="category-row">{categories.map(([icon, name, description]) => <Link className="category" href={`/jobs?category=${encodeURIComponent(name)}`} key={name}><span className="category-icon" aria-hidden="true">{icon}</span><span>{name}<small>{description}</small></span></Link>)}</div>

          <div className="section-heading" id="jobs" style={{ marginTop: 46 }}><div><div className="eyebrow">Example listings</div><h2>Good work starts here</h2><p>These sample roles preview the marketplace. Real employers and jobs will be added after launch.</p></div><Link className="section-link" href="/jobs">Browse all jobs →</Link></div>
          <div className="job-grid">{examples.map((job) => <article className="job-card" key={job.title}>
            <div className="job-meta"><div className="company"><span className="company-mark">{job.initials}</span><div><span className="company-name">{job.company}</span><span className="company-place">{job.city}</span></div></div><span className="badge">Sample</span></div>
            <h3>{job.title}</h3><p className="desc">An example listing showing how employers can describe a role and the skills they need.</p>
            <div className="tag-row"><span className="tag">{job.category}</span><span className="tag">{job.type}</span></div>
            <div className="job-foot"><span>Preview listing</span><strong>{job.pay}</strong></div>
          </article>)}</div>

          <div className="section-heading" id="how" style={{ marginTop: 52 }}><div><div className="eyebrow">Simple by design</div><h2>From profile to your next step</h2><p>A clear path to making a great connection.</p></div></div>
          <div className="steps"><div className="step"><div className="step-num">01</div><b>Build your profile</b><p>Share what you do, what you’re looking for, and the skills you bring.</p></div><div className="step"><div className="step-num">02</div><b>Find the right fit</b><p>Search opportunities by skill, location, and the way you want to work.</p></div><div className="step"><div className="step-num">03</div><b>Connect with confidence</b><p>Apply directly and keep your job conversations in one place.</p></div></div>
          <div className="banner"><div><h2>Hiring in Nepal? Find your people.</h2><p>Create an employer profile and get ready to meet local talent.</p></div><Link className="button" href="/signup?role=employer">Set up your employer profile <span aria-hidden="true">→</span></Link></div>
        </section>
      </main>

      <footer className="site-footer"><div>© 2026 Titonova Nepal</div><div className="footer-links"><a href="#how">How it works</a><a href="mailto:hello@titonova.com">Contact</a><Link href="/login">Member sign in</Link></div></footer>
    </div>
  );
}
