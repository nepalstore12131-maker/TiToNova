import Link from "next/link";
import { signUp } from "@/app/auth/actions";

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };

export default async function SignupPage({ searchParams }: Props) {
  const params = await searchParams;
  const requestedRole = Array.isArray(params.role) ? params.role[0] : params.role;
  const role = requestedRole === "employer" ? "employer" : "freelancer";
  const error = Array.isArray(params.error) ? params.error[0] : params.error;
  const success = Array.isArray(params.success) ? params.success[0] : params.success;

  return <div className="page-shell">
    <header className="site-header"><Link className="brand" href="/"><span className="brand-mark">↗</span> Titonova</Link><div className="nav-actions"><span style={{ color: "var(--muted)", fontSize: 12 }}>Already a member?</span><Link className="button secondary" href="/login">Log in</Link></div></header>
    <main className="auth-wrap"><section className="auth-card">
      <div className="eyebrow">Create your account</div><h1>Join Titonova</h1><p className="auth-copy">Set up your account to prepare for Nepal’s new work marketplace.</p>
      {error === "setup" && <div className="setup-alert">Account services are being connected. Please try again later.</div>}
      {error === "invalid" && <div className="form-alert">Check your details. Use a valid email, choose an account type, and use a password with at least 10 characters.</div>}
      {error === "signup" && <div className="form-alert">We couldn’t create that account. The email may already be registered; try logging in.</div>}
      {success === "check-email" && <div className="setup-alert">Check your email for a confirmation link. After confirming, you can sign in here.</div>}
      <form action={signUp} className="auth-form">
        <label htmlFor="full_name">Full name</label><input id="full_name" name="full_name" autoComplete="name" required maxLength={80} placeholder="Your name" />
        <label htmlFor="email">Email address</label><input id="email" name="email" type="email" autoComplete="email" required placeholder="you@example.com" />
        <label htmlFor="account_type">I’m joining as</label><select id="account_type" name="account_type" defaultValue={role}><option value="freelancer">Freelancer / job seeker</option><option value="employer">Employer / hiring team</option></select>
        <label htmlFor="company_name">Company or team name <span style={{ color: "var(--muted)", fontWeight: 400 }}>(optional)</span></label><input id="company_name" name="company_name" autoComplete="organization" maxLength={120} placeholder="For employer accounts" />
        <label htmlFor="password">Password</label><input id="password" name="password" type="password" autoComplete="new-password" minLength={10} required placeholder="At least 10 characters" />
        <button className="button full" type="submit">Create account <span aria-hidden="true">→</span></button>
      </form>
      <p className="auth-footer">Admin access is assigned separately and can’t be selected here.</p>
    </section></main>
  </div>;
}
