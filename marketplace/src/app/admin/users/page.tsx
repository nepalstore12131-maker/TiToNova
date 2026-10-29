import Link from "next/link";
import { adminCreateAccount, adminDeleteAccount, adminUpdateAccount } from "@/app/admin/users/actions";
import { PortalShell } from "@/components/portal-shell";
import { requireAdminContext } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };
const one = (value: string | string[] | undefined) => Array.isArray(value) ? value[0] ?? "" : value ?? "";
const date = (value?: string | null) => value ? new Date(value).toLocaleDateString("en-NP") : "Never";

const messages: Record<string, string> = {
  created: "The account was created and is ready to use.",
  updated: "The account details were saved.",
  deleted: "The account and its associated marketplace data were removed.",
  setup: "Account management needs a server-only Supabase service key. Add SUPABASE_SERVICE_ROLE_KEY to the Vercel project environment variables.",
  invalid: "Check the name, email, role, and password. Passwords must contain at least 10 characters.",
  create: "The account could not be created. Check whether that email is already registered and try again.",
  save: "The changes could not be saved. Check the email and try again.",
  partial: "The login details were changed, but the profile could not be updated. Reload and review this account.",
  "not-found": "That account could not be found. Reload the page and try again.",
  self: "You cannot remove your own administrator access.",
  "self-delete": "You cannot delete the administrator account you are currently using.",
  "last-admin": "Keep at least one administrator account active.",
  confirm: "Type DELETE exactly to confirm account removal.",
  delete: "The account could not be removed. Reload and try again.",
};

export default async function AdminUsersPage({ searchParams }: Props) {
  const { serviceClient } = await requireAdminContext();
  const params = await searchParams;
  const page = Math.max(1, Math.min(10000, Number.parseInt(one(params.page) || "1", 10) || 1));
  const perPage = 50;
  const success = messages[one(params.success)];
  const error = messages[one(params.error)];

  let accounts: Array<{
    id: string;
    email: string;
    fullName: string;
    companyName: string;
    role: string;
    headline: string;
    bio: string;
    location: string;
    skills: string[];
    portfolioUrl: string;
    linkedinUrl: string;
    emailConfirmedAt?: string;
    createdAt: string;
    lastSignInAt?: string;
  }> = [];
  let loadFailed = false;
  let hasNext = false;

  if (serviceClient) {
    const { data, error: listError } = await serviceClient.auth.admin.listUsers({ page, perPage });
    if (listError) {
      loadFailed = true;
      console.error("Titonova admin list accounts failed", { code: listError.code, status: listError.status });
    } else {
      hasNext = data.users.length === perPage;
      const ids = data.users.map((member) => member.id);
      const { data: profiles, error: profilesError } = ids.length
        ? await serviceClient.from("profiles").select("id,full_name,company_name,role,headline,bio,location,skills,portfolio_url,linkedin_url").in("id", ids)
        : { data: [], error: null };
      if (profilesError) {
        loadFailed = true;
        console.error("Titonova admin list profiles failed", { code: profilesError.code });
      } else {
        const byId = new Map((profiles ?? []).map((profile) => [profile.id, profile]));
        accounts = data.users.map((member) => {
          const profile = byId.get(member.id);
          return {
            id: member.id,
            email: member.email ?? "",
            fullName: profile?.full_name || String(member.user_metadata?.full_name ?? ""),
            companyName: profile?.company_name || String(member.user_metadata?.company_name ?? ""),
            role: profile?.role ?? "freelancer",
            headline: profile?.headline ?? "",
            bio: profile?.bio ?? "",
            location: profile?.location ?? "",
            skills: profile?.skills ?? [],
            portfolioUrl: profile?.portfolio_url ?? "",
            linkedinUrl: profile?.linkedin_url ?? "",
            emailConfirmedAt: member.email_confirmed_at,
            createdAt: member.created_at,
            lastSignInAt: member.last_sign_in_at,
          };
        });
      }
    }
  }

  return <PortalShell role="admin" activePath="/admin/users">
    <div className="eyebrow">Platform administration</div>
    <h1>Accounts</h1>
    <p style={{ color: "var(--muted)", fontSize: 13 }}>Manage job seekers, employers, and administrator access. Passwords are never displayed; setting a new password replaces the old one.</p>
    {success && <div className="setup-alert" style={{ marginTop: 16 }}>{success}</div>}
    {error && <div className="form-alert" style={{ marginTop: 16 }}>{error}</div>}

    {!serviceClient ? <section className="dashboard-card"><h2 style={{ marginTop: 0 }}>Finish secure setup</h2><p style={{ color: "var(--muted)", fontSize: 13 }}>{messages.setup} Get the secret from Supabase project settings and add it only to Vercel as a server environment variable. Do not put it in a `NEXT_PUBLIC_` variable or share it in chat.</p></section> : <>
      <section className="dashboard-card admin-create-card">
        <div className="eyebrow">New account</div>
        <h2 style={{ margin: "6px 0 4px", fontSize: 21 }}>Create an account</h2>
        <p style={{ color: "var(--muted)", fontSize: 12 }}>This creates a confirmed account. Give its temporary password to the account owner through a safe channel.</p>
        <form action={adminCreateAccount} className="auth-form admin-account-grid">
          <div><label htmlFor="new_full_name">Full name</label><input id="new_full_name" name="full_name" required maxLength={80} /></div>
          <div><label htmlFor="new_email">Email address</label><input id="new_email" name="email" type="email" required maxLength={254} /></div>
          <div><label htmlFor="new_role">Account type</label><select id="new_role" name="role" defaultValue="freelancer"><option value="freelancer">Job seeker</option><option value="employer">Employer</option><option value="admin">Administrator</option></select></div>
          <div><label htmlFor="new_company">Company or team (optional)</label><input id="new_company" name="company_name" maxLength={120} /></div>
          <div><label htmlFor="new_password">Temporary password</label><input id="new_password" name="password" type="password" required minLength={10} maxLength={72} autoComplete="new-password" /></div>
          <button className="button" type="submit">Create account →</button>
        </form>
      </section>

      <section style={{ marginTop: 30 }}>
        <div className="admin-section-heading"><div><div className="eyebrow">Member directory</div><h2 style={{ margin: "6px 0", fontSize: 22 }}>All accounts</h2></div><span style={{ color: "var(--muted)", fontSize: 12 }}>Page {page}</span></div>
        {loadFailed ? <div className="form-alert">Accounts could not be loaded. Check the server key and try again.</div> : !accounts.length ? <div className="dashboard-card"><p style={{ margin: 0, color: "var(--muted)" }}>No accounts are on this page.</p></div> : <div className="admin-account-list">
          {accounts.map((account) => <article className="dashboard-card admin-member-card" key={account.id}>
            <div className="admin-member-heading"><div><strong>{account.fullName || "Unnamed account"}</strong><span>{account.email}</span></div><span className="status-tag">{account.role}</span></div>
            <p className="admin-member-meta">{account.emailConfirmedAt ? "Email confirmed" : "Email not confirmed"} · Joined {date(account.createdAt)} · Last sign in {date(account.lastSignInAt)}</p>
            <form action={adminUpdateAccount} className="auth-form admin-account-grid admin-account-edit">
              <input type="hidden" name="user_id" value={account.id} />
              <div><label htmlFor={`name-${account.id}`}>Full name</label><input id={`name-${account.id}`} name="full_name" defaultValue={account.fullName} required maxLength={80} /></div>
              <div><label htmlFor={`email-${account.id}`}>Email address</label><input id={`email-${account.id}`} name="email" type="email" defaultValue={account.email} required maxLength={254} /></div>
              <div><label htmlFor={`role-${account.id}`}>Account type</label><select id={`role-${account.id}`} name="role" defaultValue={account.role}><option value="freelancer">Job seeker</option><option value="employer">Employer</option><option value="admin">Administrator</option></select></div>
              <div><label htmlFor={`company-${account.id}`}>Company or team</label><input id={`company-${account.id}`} name="company_name" defaultValue={account.companyName} maxLength={120} /></div>
              <div><label htmlFor={`password-${account.id}`}>Set new password (optional)</label><input id={`password-${account.id}`} name="password" type="password" minLength={10} maxLength={72} autoComplete="new-password" placeholder="Leave blank to keep current" /></div>
              <details className="admin-profile-details"><summary>Profile details</summary><div className="admin-account-grid"><div><label htmlFor={`headline-${account.id}`}>Headline</label><input id={`headline-${account.id}`} name="headline" defaultValue={account.headline} maxLength={120} /></div><div><label htmlFor={`location-${account.id}`}>Location</label><input id={`location-${account.id}`} name="location" defaultValue={account.location} maxLength={120} /></div><div className="admin-profile-wide"><label htmlFor={`bio-${account.id}`}>About</label><textarea className="cover-note" id={`bio-${account.id}`} name="bio" defaultValue={account.bio} maxLength={3000} /></div><div className="admin-profile-wide"><label htmlFor={`skills-${account.id}`}>Skills (comma separated)</label><textarea className="cover-note admin-short-textarea" id={`skills-${account.id}`} name="skills" defaultValue={account.skills.join(", ")} maxLength={1200} /></div><div><label htmlFor={`portfolio-${account.id}`}>Portfolio URL</label><input id={`portfolio-${account.id}`} name="portfolio_url" type="url" defaultValue={account.portfolioUrl} maxLength={300} /></div><div><label htmlFor={`linkedin-${account.id}`}>LinkedIn URL</label><input id={`linkedin-${account.id}`} name="linkedin_url" type="url" defaultValue={account.linkedinUrl} maxLength={300} /></div></div></details>
              <button className="button small" type="submit">Save changes</button>
            </form>
            <form action={adminDeleteAccount} className="admin-delete-row">
              <input type="hidden" name="user_id" value={account.id} />
              <label htmlFor={`delete-${account.id}`}>Permanently remove this account and its job posts and applications: type DELETE</label>
              <input id={`delete-${account.id}`} name="confirmation" required pattern="DELETE" title="Type DELETE exactly" />
              <button className="button small danger" type="submit">Remove account</button>
            </form>
          </article>)}
        </div>}
        <nav className="admin-pagination" aria-label="Account pages">
          {page > 1 && <Link className="button secondary small" href={`/admin/users?page=${page - 1}`}>← Previous</Link>}
          {hasNext && <Link className="button secondary small" href={`/admin/users?page=${page + 1}`}>Next →</Link>}
        </nav>
      </section>
    </>}
  </PortalShell>;
}
