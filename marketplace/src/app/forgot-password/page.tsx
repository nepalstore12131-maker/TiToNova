import { BrandMark } from "@/components/brand-mark";
import Link from "next/link";
import { requestPasswordReset } from "@/app/auth/actions";

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };

export default async function ForgotPasswordPage({ searchParams }: Props) {
  const params = await searchParams;
  const error = Array.isArray(params.error) ? params.error[0] : params.error;
  const sent = Array.isArray(params.sent) ? params.sent[0] : params.sent;

  return <div className="page-shell">
    <header className="site-header"><Link className="brand" href="/"><BrandMark /> Titonova</Link><div className="nav-actions"><Link className="button secondary" href="/login">Log in</Link></div></header>
    <main className="auth-wrap"><section className="auth-card">
      <div className="eyebrow">Account recovery</div><h1>Reset your password</h1>
      <p className="auth-copy">Enter the email address on your account. We’ll send a secure reset link if it can receive email.</p>
      {error === "setup" && <div className="setup-alert">Account services are temporarily unavailable. Please try again later.</div>}
      {error === "email-invalid" && <div className="form-alert">Enter a valid email address and try again.</div>}
      {error === "rate-limit" && <div className="form-alert">Too many reset requests were made recently. Wait a little while before trying again.</div>}
      {sent && <div className="setup-alert" role="status">If an account with that address can receive email, a password reset link is on its way. Check your inbox and spam folder.</div>}
      <form action={requestPasswordReset} className="auth-form">
        <label htmlFor="email">Email address</label>
        <input id="email" name="email" type="email" autoComplete="email" required maxLength={254} placeholder="you@example.com" />
        <button className="button full" type="submit">Send reset link →</button>
      </form>
      <p className="auth-footer"><Link href="/login">Back to job seeker sign in</Link></p>
      <p className="auth-footer"><Link href="/employer/login">Employer sign in</Link></p>
      <p className="auth-footer"><Link href="/admin/login">Administrator sign in</Link></p>
    </section></main>
  </div>;
}
