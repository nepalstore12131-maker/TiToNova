import Link from "next/link";
import { MarketplaceHeader } from "@/components/marketplace-header";
import { UiIcon } from "@/components/workspace-ui";
import { publicMetadata } from "@/lib/seo";
import "../marketplace.css";

export const metadata = publicMetadata(
  "Hire Remote Talent in Nepal From Anywhere | Titonova",
  "Employers worldwide can find Nepal-based talent for remote design, development, editing, support and more. Explore how international hiring works on Titonova.",
  "/hire-global",
);

const services = [
  ["Design & creative", "Graphics, branding, video editing and social media assets."],
  ["Development", "Websites, applications, technical assistance and testing."],
  ["Marketing & content", "Writing, content management and digital marketing support."],
  ["Business support", "Virtual assistance, data entry and customer support."],
];

export default function GlobalHiringPage() {
  return <div className="page-shell market-home">
    <MarketplaceHeader />
    <main>
      <section className="market-hero">
        <div className="market-hero-copy">
          <span className="market-overline"><i /> INTERNATIONAL REMOTE HIRING</span>
          <h1>Your team.<br />From anywhere.<br /><em>Powered by Nepali talent.</em></h1>
          <p>Run a business anywhere in the world? Find people based in Nepal for remote projects, part-time support or longer-term work. No country-specific signup restriction is imposed by this page.</p>
          <div className="market-hiring-actions">
            <Link className="button" href="/signup?role=employer">Start hiring <UiIcon size={18}/></Link>
            <Link href="/jobs?mode=remote">Explore remote opportunities ↗</Link>
          </div>
          <div className="market-hero-note"><UiIcon name="shield" size={16}/> Clear pay, scope and working hours help both sides make informed decisions.</div>
        </div>
        <div className="opportunity-stage">
          <div className="stage-caption"><span className="live-dot"/> NEPAL-BASED · WORLDWIDE</div>
          <div className="stage-heading">Real work.<br /><em>Beyond borders.</em></div>
          <div className="stage-job">
            <h2>How it works</h2>
            <p>Publish a remote role → Review Nepal-based applicants → Discuss the details → Agree on a fair working arrangement.</p>
            <Link href="/signup?role=employer">Create an employer account ↗</Link>
          </div>
          <div className="stage-bottom"><span>ANY COUNTRY · REMOTE-FIRST</span></div>
        </div>
      </section>
      <section className="market-section">
        <div className="market-section-heading">
          <div><span className="market-overline">FIND THE RIGHT SKILLS</span><h2>One country of talent.<br /><em>A world of possibilities.</em></h2></div>
          <p>For individuals, small businesses, startups and established teams worldwide.</p>
        </div>
        <div className="journey-steps">
          {services.map(([title,description],i)=><article key={title}><div><span>{String(i+1).padStart(2,"0")}</span><UiIcon name="briefcase" size={24}/></div><h3>{title}</h3><p>{description}</p></article>)}
        </div>
      </section>
      <section className="market-section market-journey">
        <div className="market-section-heading"><div><span className="market-overline">HIRING ACROSS BORDERS</span><h2>Simple steps.<br /><em>Clear expectations.</em></h2></div></div>
        <div className="journey-steps">
          {[
            ["01","Describe remote work","Choose Remote when posting. State that you want Nepal-based applicants, your country, the role, tasks and required skills."],
            ["02","Agree on time and pay","Explain your time zone, expected overlap, deadline, hourly or project pay, and the payment method both sides can use."],
            ["03","Review applicants","Discuss portfolios and experience through Titonova's application and conversation tools before agreeing on work."],
          ].map(([n,title,copy])=><article key={n}><div><span>{n}</span><UiIcon name="people" size={24}/></div><h3>{title}</h3><p>{copy}</p></article>)}
        </div>
      </section>
      <section className="market-hiring" id="international-employers">
        <div>
          <span className="market-overline">IMPORTANT FOR INTERNATIONAL EMPLOYERS</span>
          <h2>Great opportunities.<br/><em>Fair terms for everyone.</em></h2>
          <p>Titonova's job listings currently record pay in Nepali rupees. If you budget in another currency, state the currency and exchange assumptions in the description and enter an accurate NPR amount in the pay fields. Agree on payment method, time-zone overlap, deliverables and fair compensation before work begins.</p>
          <p>Employer Premium is currently manually approved; automated international checkout and cross-border worker payouts are not yet built into Titonova. Employers and workers must check the tax, labor and contractor rules that apply to them.</p>
          <div className="market-hiring-actions"><Link className="button" href="/signup?role=employer">Create employer account <UiIcon size={18}/></Link><Link href="/contact">Contact Titonova ↗</Link></div>
        </div>
        <div className="hiring-feature-stack">
          {[
            ["shield","Clear scope","Spell out deliverables, revisions and timelines."],
            ["message","Better coordination","Tell applicants which time zone and hours matter."],
            ["briefcase","Respectful pay","Advertise realistic pay and never request unpaid trial projects."],
          ].map(([icon,title,copy])=><div key={title}><UiIcon name={icon} size={24}/><div><strong>{title}</strong><p>{copy}</p></div></div>)}
        </div>
      </section>
      <section className="market-section">
        <div className="market-section-heading"><div><span className="market-overline">FOR JOB SEEKERS IN NEPAL</span><h2>Build your career.<br /><em>Reach beyond Nepal.</em></h2></div><p>Create your profile, show examples of your work and explore opportunities you can do remotely.</p></div>
        <div className="market-hiring-actions"><Link className="button" href="/jobs?mode=remote">Browse remote jobs <UiIcon size={18}/></Link><Link href="/signup">Join as a job seeker ↗</Link></div>
        <p style={{fontSize:13,marginTop:16}}>The remote jobs filter includes all remote listings, not only those posted by international employers. Always review the employer and job details before applying.</p>
      </section>
    </main>
  </div>;
}
