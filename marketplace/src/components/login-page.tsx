import Link from "next/link";
import { signIn } from "@/app/auth/actions";

type Role = "freelancer" | "employer" | "admin";
type Props = {
  role: Role;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

const settings: Record<Role, { heading: string; description: string; label: string; home: string }> = {
  freelancer: {
    heading: "Job seeker sign in",
    description: "Log in to find work and follow your applications.",
    label: "Freelancer / job seeker",
    home: "/login",
  },
  employer: {
    heading: "Employer sign in",
    description: "Log in to manage roles and review applications from local talent.",
    label: "Employer / hiring team",
    home: "/employer/login",
  },
  admin: {
    heading: "Administrator sign in",
    description: "Use your administrator account to review marketplace listings.",
    label: "Administrator",
    home: "/admin/login",
  },
};

export async function LoginPage({ role, searchParams }: Props) {
  const params = await searchParams;
  const error = Array.isArray(params.error) ? params.error[0] : params.error;
  const success = Array.isArray(params.success) ? params.success[0] : params.success;
  const requestedNext = Array.isArray(params.next) ? params.next[0] : params.next;
  const next = requestedNext?.startsWith("/") && !requestedNext.startsWith("//") && !requestedNext.startsWith("/login") ? requestedNext : "";
  const page = settings[role];

  return <div className="page-shell">
    <header className="site-header"><Link className="brand" href="/"><span className="brand-mark">↗</span> Titonova</Link><div className="nav-actions"><Link className="text-button" href="/jobs">Browse jobs</Link>{role !== "admin" && <Link className="button secondary" href={`/signup${role === "employer" ? "?role=employer" : ""}`}>Create account</Link>}</div></header>
    <main className="auth-wrap"><section className="auth-card">
      <div className="eyebrow">{page.label}</div><h1>{page.heading}</h1><p className="auth-copy">{page.description}</p>
      {success === "password-updated" && <div className="setup-alert">Your password was updated. Sign in with your new password.</div>}
      {error === "setup" && <div className="setup-alert">Account services are being connected. Please try again later.</div>}
      {error === "invalid" && <div className="form-alert">Enter a valid email address and password.</div>}
      {error === "credentials" && <div className="form-alert">Those details didn’t match an account. Check your email and password, then try again.</div>}
      {error === "role" && <div className="form-alert">This account uses a different sign-in page. Choose the sign-in page that matches your account type.</div>}
      {error === "profile" && <div className="form-alert">We couldn’t load your account profile. Please try again, and contact support if the problem continues.</div>}
      {error === "confirmation" && <div className="form-alert">Confirm your email before signing in. If the link expired, you can request another confirmation email.</div>}
      <form action={signIn} className="auth-form">
        <input type="hidden" name="expected_role" value={role} />
        {next && <input type="hidden" name="next" value={next} />}
        <label htmlFor="email">Email address</label><input id="email" name="email" type="email" autoComplete="email" required placeholder="you@example.com" />
        <label htmlFor="password">Password</label><input id="password" name="password" type="password" autoComplete="current-password" required placeholder="Your password" />
        <button className="button full" type="submit">Log in <span aria-hidden="true">→</span></button>
      </form>
      <p className="auth-footer"><Link href="/forgot-password">Forgot your password?</Link></p>
      {error === "confirmation" && <p className="auth-footer">Need another link? <Link href="/signup?error=confirmation">Resend email confirmation</Link></p>}
      {role === "freelancer" && <p className="auth-footer">Hiring a team? <Link href="/employer/login">Employer sign in</Link></p>}
      {role === "employer" && <p className="auth-footer">Looking for work? <Link href="/login">Job seeker sign in</Link></p>}
      {role !== "admin" && <p className="auth-footer">New to Titonova? <Link href={`/signup${role === "employer" ? "?role=employer" : ""}`}>Create an account</Link></p>}
    </section></main>
  </div>;
}
