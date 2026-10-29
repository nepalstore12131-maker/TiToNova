import Link from "next/link";
import { updatePassword } from "@/app/auth/actions";
import { createClient } from "@/lib/supabase/server";

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };

export const dynamic = "force-dynamic";

export default async function ResetPasswordPage({ searchParams }: Props) {
  const params = await searchParams;
  const error = Array.isArray(params.error) ? params.error[0] : params.error;
  const supabase = await createClient();
  const { data: { user } } = supabase ? await supabase.auth.getUser() : { data: { user: null } };

  return <div className="page-shell">
    <header className="site-header"><Link className="brand" href="/"><span className="brand-mark">↗</span> Titonova</Link><div className="nav-actions"><Link className="button secondary" href="/login">Log in</Link></div></header>
    <main className="auth-wrap"><section className="auth-card">
      <div className="eyebrow">Account recovery</div><h1>Choose a new password</h1>
      {!supabase && <div className="setup-alert">Account services are temporarily unavailable. Please try again later.</div>}
      {supabase && !user && <>
        <div className="form-alert">This reset link has expired or has already been used. Request a fresh link to continue.</div>
        <Link className="button full" href="/forgot-password">Request another reset link →</Link>
      </>}
      {user && <>
        <p className="auth-copy">Choose a password with at least 10 characters. You’ll need to sign in again after it is changed.</p>
        {error === "weak-password" && <div className="form-alert">Choose a stronger password with at least 10 characters.</div>}
        {error === "mismatch" && <div className="form-alert">The two passwords don’t match. Try again.</div>}
        {error === "confirmation" && <div className="form-alert">Your reset session expired. Request a fresh reset link.</div>}
        {error === "setup" && <div className="setup-alert">Account services are temporarily unavailable. Please try again later.</div>}
        {error === "save" && <div className="form-alert">We couldn’t update the password. Try again or request a new reset link.</div>}
        <form action={updatePassword} className="auth-form">
          <label htmlFor="password">New password</label>
          <input id="password" name="password" type="password" autoComplete="new-password" required minLength={10} />
          <label htmlFor="confirm_password">Confirm new password</label>
          <input id="confirm_password" name="confirm_password" type="password" autoComplete="new-password" required minLength={10} />
          <button className="button full" type="submit">Update password →</button>
        </form>
      </>}
    </section></main>
  </div>;
}
