import Link from "next/link";
import { cookies } from "next/headers";
import { resendSignupConfirmation, signUp, verifySignupCode } from "@/app/auth/actions";

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };

export default async function SignupPage({ searchParams }: Props) {
  const params = await searchParams;
  const requestedRole = Array.isArray(params.role) ? params.role[0] : params.role;
  const role = requestedRole === "employer" ? "employer" : "freelancer";
  const error = Array.isArray(params.error) ? params.error[0] : params.error;
  const success = Array.isArray(params.success) ? params.success[0] : params.success;
  const resend = Array.isArray(params.resend) ? params.resend[0] : params.resend;
  const pendingEmail = (await cookies()).get("titonova_pending_signup_email")?.value ?? "";
  const waitingForCode = success === "check-email" || success === "resent" || error === "confirmation" || error === "invalid-code" || error === "rate-limit";
  const showResend = waitingForCode || resend === "1";

  return <div className="page-shell">
    <header className="site-header"><Link className="brand" href="/"><span className="brand-mark">↗</span> Titonova</Link><div className="nav-actions"><span style={{ color: "var(--muted)", fontSize: 12 }}>Already a member?</span><Link className="button secondary" href={role === "employer" ? "/employer/login" : "/login"}>Log in</Link></div></header>
    <main className="auth-wrap"><section className="auth-card">
      <div className="eyebrow">Create your account</div><h1>Join Titonova</h1><p className="auth-copy">Set up your account to prepare for Nepal’s new work marketplace.</p>
      {error === "setup" && <div className="setup-alert">Account services are being connected. Please try again later.</div>}
      {error === "invalid" && <div className="form-alert">Check your details. Use a valid email, choose an account type, and use a password with at least 10 characters.</div>}
      {error === "exists" && <div className="form-alert">An account already uses this email address. Log in or use a different email.</div>}
      {error === "rate-limit" && <div className="form-alert">Too many signup or confirmation attempts were made recently. Please wait before requesting another email, then try again.</div>}
      {error === "weak-password" && <div className="form-alert">Choose a stronger password, then try again.</div>}
      {error === "email-invalid" && <div className="form-alert">Please check the email address and try again.</div>}
      {error === "unavailable" && <div className="form-alert">New account signup is temporarily unavailable. Please try again later.</div>}
      {error === "try-again" && <div className="form-alert">We couldn’t finish creating your account. The email may not be the problem. Please try again in a few minutes.</div>}
      {error === "confirmation" && <div className="form-alert">That confirmation link expired or could not be verified. Request a fresh link below.</div>}
      {error === "verification-disabled" && <div className="form-alert">Email verification is not enabled for this project yet. Please contact the site administrator before creating an account.</div>}
      {success === "check-email" && <div className="setup-alert">We sent a six-digit code to your email. Enter it below to verify your address and activate your account.</div>}
      {success === "resent" && <div className="setup-alert">If this address needs confirmation, a new code is on its way. Check your inbox and spam folder.</div>}
      {error === "invalid-code" && <div className="form-alert">That code couldn’t be verified. Check the six digits and try again, or request a new code.</div>}
      {waitingForCode && <section className="dashboard-card" style={{ margin: "0 0 16px", padding: 16 }}>
        <form action={verifySignupCode} className="auth-form">
          <label htmlFor="verification_email">Email address</label>
          <input id="verification_email" name="email" type="email" autoComplete="email" required defaultValue={pendingEmail} placeholder="you@example.com" />
          <label htmlFor="verification_code">Six-digit email code</label>
          <input id="verification_code" name="token" type="text" inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6}" minLength={6} maxLength={6} required placeholder="000000" />
          <button className="button full" type="submit">Verify email <span aria-hidden="true">→</span></button>
        </form>
      </section>}
      {showResend && <section className="dashboard-card" style={{ margin: "0 0 16px", padding: 16 }}>
        <form action={resendSignupConfirmation} className="auth-form">
          <label htmlFor="confirmation_email">Send a new code</label>
          <input id="confirmation_email" name="email" type="email" autoComplete="email" required defaultValue={pendingEmail} placeholder="you@example.com" />
          <button className="button secondary" type="submit">Resend code</button>
        </form>
      </section>}
      {!waitingForCode && <form action={signUp} className="auth-form">
        <label htmlFor="full_name">Full name</label><input id="full_name" name="full_name" autoComplete="name" required maxLength={80} placeholder="Your name" />
        <label htmlFor="email">Email address</label><input id="email" name="email" type="email" autoComplete="email" required placeholder="you@example.com" />
        <label htmlFor="account_type">I’m joining as</label><select id="account_type" name="account_type" defaultValue={role}><option value="freelancer">Freelancer / job seeker</option><option value="employer">Employer / hiring team</option></select>
        <label htmlFor="company_name">Company or team name <span style={{ color: "var(--muted)", fontWeight: 400 }}>(optional)</span></label><input id="company_name" name="company_name" autoComplete="organization" maxLength={120} placeholder="For employer accounts" />
        <label htmlFor="password">Password</label><input id="password" name="password" type="password" autoComplete="new-password" minLength={10} required placeholder="At least 10 characters" />
        <button className="button full" type="submit">Create account <span aria-hidden="true">→</span></button>
      </form>}
      <p className="auth-footer">Admin access is assigned separately and can’t be selected here.</p>
    </section></main>
  </div>;
}
