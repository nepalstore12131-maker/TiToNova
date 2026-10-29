import { redirect } from "next/navigation";
import { saveProfile } from "@/app/jobs/actions";
import { PortalShell, type AccountRole } from "@/components/portal-shell";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };
const one = (value: string | string[] | undefined) => Array.isArray(value) ? value[0] ?? "" : value ?? "";

export default async function ProfilePage({ searchParams }: Props) {
  const supabase = await createClient();
  if (!supabase) return <main className="dashboard"><div className="setup-alert">Connect the shared database to manage your profile.</div></main>;
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const [{ data: profile, error: profileError }, params] = await Promise.all([
    supabase.from("profiles").select("full_name,company_name,role,headline,bio,location,skills,portfolio_url,linkedin_url").eq("id", user.id).maybeSingle(),
    searchParams,
  ]);
  if (profileError || !profile) return <main className="dashboard"><div className="form-alert" role="alert">We couldn’t load your profile. Refresh the page and try again.</div></main>;
  const role = profile.role as AccountRole;
  if (role === "admin") redirect("/admin");

  return <PortalShell role={role} activePath="/dashboard/profile">
    <div className="eyebrow">Your public details</div><h1>{role === "employer" ? "Company profile" : "My profile"}</h1>
    <p style={{ color: "var(--muted)", fontSize: 13 }}>These details help people understand who they’re working with. Your email stays private.</p>
    {one(params.success) === "saved" && <div className="setup-alert">Your profile was updated.</div>}
    {one(params.error) && <div className="form-alert">{one(params.error) === "invalid" ? "Check field lengths and enter full website links beginning with http:// or https://." : "We couldn’t save your profile. Please try again."}</div>}
    <section className="dashboard-card"><form action={saveProfile} className="auth-form">
      <label htmlFor="full_name">{role === "employer" ? "Contact person" : "Full name"}</label><input id="full_name" name="full_name" defaultValue={profile?.full_name ?? ""} maxLength={80} required />
      {role === "employer" && <><label htmlFor="company_name">Company or team name</label><input id="company_name" name="company_name" defaultValue={profile?.company_name ?? ""} maxLength={120} /></>}
      <label htmlFor="headline">{role === "employer" ? "Short company introduction" : "Professional headline"}</label><input id="headline" name="headline" defaultValue={profile?.headline ?? ""} maxLength={120} placeholder={role === "employer" ? "A short description of your team" : "e.g. Frontend developer focused on accessible web apps"} />
      <label htmlFor="bio">About</label><textarea className="cover-note" id="bio" name="bio" defaultValue={profile?.bio ?? ""} maxLength={3000} placeholder="Tell people about your experience, team, or the work you do…" />
      <label htmlFor="location">Location</label><input id="location" name="location" defaultValue={profile?.location ?? ""} maxLength={120} placeholder="Kathmandu, Pokhara, or Remote" />
      {role === "freelancer" && <><label htmlFor="skills">Skills</label><textarea className="cover-note" id="skills" name="skills" defaultValue={(profile?.skills ?? []).join(", ")} maxLength={1200} placeholder="Add up to 20 skills, separated by commas" /></>}
      <label htmlFor="portfolio_url">Portfolio or website</label><input id="portfolio_url" name="portfolio_url" type="url" defaultValue={profile?.portfolio_url ?? ""} maxLength={300} placeholder="https://example.com" />
      {role === "freelancer" && <><label htmlFor="linkedin_url">LinkedIn profile</label><input id="linkedin_url" name="linkedin_url" type="url" defaultValue={profile?.linkedin_url ?? ""} maxLength={300} placeholder="https://linkedin.com/in/your-name" /></>}
      <button className="button" type="submit">Save profile →</button>
    </form></section>
  </PortalShell>;
}
