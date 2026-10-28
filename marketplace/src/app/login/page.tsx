import Link from "next/link";
import { signIn } from "@/app/auth/actions";

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };

export default async function LoginPage({ searchParams }: Props) {
  const params = await searchParams;
  const error = Array.isArray(params.error) ? params.error[0] : params.error;
  const requestedNext = Array.isArray(params.next) ? params.next[0] : params.next;
  const next = requestedNext?.startsWith("/") && !requestedNext.startsWith("//") && !requestedNext.startsWith("/login") ? requestedNext : "";

  return <div className="page-shell">
    <header className="site-header"><Link className="brand" href="/"><span className="brand-mark">↗</span> Titonova</Link><div className="nav-actions"><span style={{ color: "var(--muted)", fontSize: 12 }}>New to Titonova?</span><Link className="button secondary" href="/signup">Create account</Link></div></header>
    <main className="auth-wrap"><section className="auth-card">
      <div className="eyebrow">Member access</div><h1>Welcome back</h1><p className="auth-copy">Log in to continue to your Titonova account.</p>
      {error === "setup" && <div className="setup-alert">Account services are being connected. Please try again later.</div>}
      {error === "invalid" && <div className="form-alert">Enter a valid email address and password.</div>}
      {error === "credentials" && <div className="form-alert">Those details didn’t match an account. Check your email and password, then try again.</div>}
      {error === "confirmation" && <div className="form-alert">That confirmation link may have expired. Sign in or request a new confirmation email.</div>}
      <form action={signIn} className="auth-form">
        {next && <input type="hidden" name="next" value={next} />}
        <label htmlFor="email">Email address</label><input id="email" name="email" type="email" autoComplete="email" required placeholder="you@example.com" />
        <label htmlFor="password">Password</label><input id="password" name="password" type="password" autoComplete="current-password" required placeholder="Your password" />
        <button className="button full" type="submit">Log in <span aria-hidden="true">→</span></button>
      </form>
      <p className="auth-footer">Need an account? <Link href="/signup">Join Titonova</Link></p>
    </section></main>
  </div>;
}
