import {loadPaymentSummary} from "@/lib/payment-summary";
import {PaymentOverview} from "@/components/payment-overview";
import Link from "next/link";
import { redirect } from "next/navigation";
import { submitEmployerPayment } from "@/app/dashboard/billing/actions";
import { PortalShell } from "@/components/portal-shell";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };
const one = (value: string | string[] | undefined) => Array.isArray(value) ? value[0] ?? "" : value ?? "";
const date = (value?: string | null) => value ? new Date(value).toLocaleString("en-NP", { dateStyle: "medium", timeStyle: "short" }) : "—";
const amount = (value: number) => `NPR ${value.toLocaleString("en-NP")}`;
const paymentErrors: Record<string, string> = {
  invalid: "Enter a transaction code and upload a JPG, PNG, WebP, or PDF proof file no larger than 5 MB.",
  "not-ready": "Premium billing is not configured yet. Please contact Titonova support.",
  method: "That payment method is not available. Choose one of the displayed methods.",
  pending: "You already have a payment waiting for review.",
  upload: "The proof file could not be uploaded. Please try again.",
  duplicate: "That transaction code is already on file. Check it and contact support if needed.",
  submit: "The payment request could not be saved. Please try again.",
};

export default async function EmployerBillingPage({ searchParams }: Props) {
  const supabase = await createClient();
  if (!supabase) return <main className="dashboard"><div className="setup-alert">Connect the database to view Premium billing.</div></main>;
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/employer/login");
  const { data: profile, error: profileError } = await supabase.from("profiles").select("role,employer_premium_until").eq("id", user.id).maybeSingle();
  if (profileError || !profile) return <main className="dashboard"><div className="form-alert">We couldn’t load your employer account.</div></main>;
  if (profile.role !== "employer") redirect("/dashboard?error=employer-only");

  const params = await searchParams;
  const page = Math.max(1,Math.min(10000,Number.parseInt(one(params.page)||"1",10)||1));
  const [{ data: settings, error: settingsError }, { data: requests, error: requestsError, count: requestCount }, summary] = await Promise.all([
    supabase.from("employer_payment_settings").select("*").eq("id", 1).maybeSingle(),
    supabase.from("employer_payment_requests").select("id,payment_method,transaction_code,amount_npr,plan_duration_days,status,review_note,created_at,reviewed_at",{count:"exact"}).eq("employer_id", user.id).order("created_at", { ascending: false }).range((page-1)*10,page*10-1),
    loadPaymentSummary(supabase,user.id),
  ]);
  const errorKey = one(params.error);
  const success = one(params.success);
  const isPremium = Boolean(profile.employer_premium_until && new Date(profile.employer_premium_until).getTime() > Date.now());
  const methods = [
    { id: "esewa", name: "eSewa", available: Boolean(settings?.esewa_account_id) },
    { id: "khalti", name: "Khalti", available: Boolean(settings?.khalti_account_id || settings?.khalti_payment_url) },
    { id: "bank", name: "Bank transfer", available: Boolean(settings?.bank_name && settings?.bank_account_number) },
  ].filter((method) => method.available);
  const paymentReady = !settingsError && Boolean(settings && settings.premium_price_npr > 0 && methods.length);
  const hasPending = (summary?.pendingCount ?? 0) > 0;

  return <PortalShell role="employer" activePath="/dashboard/billing">
    <div className="eyebrow">Employer workspace</div><h1>Payments &amp; billing</h1>
    <p style={{ color: "var(--muted)", fontSize: 13 }}>Premium lets your team post jobs and use employer hiring tools. Pay using one of the account details below, then send the transaction code and proof for review.</p>
    <PaymentOverview summary={summary}/><section className="dashboard-card premium-status-card">
      <div><div className="detail-label" style={{ marginTop: 0 }}>Account status</div><h2 style={{ margin: "4px 0 6px" }}>{isPremium ? "Premium active" : "Not active yet"}</h2><p style={{ margin: 0, color: "var(--muted)", fontSize: 12 }}>{isPremium ? `Access through ${date(profile.employer_premium_until)}.` : "Job posting stays locked until an administrator approves your payment."}</p></div>
      {isPremium && <span className="status-tag status-published">Eligible to post</span>}
    </section>

    {success === "submitted" && <div className="setup-alert" style={{ marginTop: 16 }}>Your payment proof was sent. An administrator will review it before Premium access is enabled.</div>}
    {errorKey && <div className="form-alert" style={{ marginTop: 16 }} role="alert">{paymentErrors[errorKey] || "We couldn’t submit your payment proof. Please try again."}</div>}

    <div className="billing-grid">
      <section className="dashboard-card">
        <div className="eyebrow">Employer Premium</div><h2 style={{ margin: "6px 0" }}>{settings?.premium_price_npr ? amount(settings.premium_price_npr) : "Price not set"}</h2>
        <p style={{ color: "var(--muted)", fontSize: 12, marginTop: 0 }}>{settings?.premium_duration_days || 30} days of access after approval</p>
        {settings?.payment_instructions && <p className="admin-content-copy">{settings.payment_instructions}</p>}
        {settings?.esewa_account_id && <div className="payment-detail"><strong>eSewa</strong><span>{settings.esewa_account_name || "Account"} · {settings.esewa_account_id}</span></div>}
        {(settings?.khalti_account_id || settings?.khalti_payment_url) && <div className="payment-detail"><strong>Khalti</strong><span>{settings.khalti_account_name || "Account"}{settings.khalti_account_id ? ` · ${settings.khalti_account_id}` : ""}</span>{settings.khalti_payment_url && <a href={settings.khalti_payment_url} target="_blank" rel="noreferrer">Open Khalti payment link ↗</a>}</div>}
        {settings?.bank_name && settings?.bank_account_number && <div className="payment-detail"><strong>{settings.bank_name}</strong><span>{settings.bank_account_name || "Account holder"} · {settings.bank_account_number}</span></div>}
        {!paymentReady && <div className="setup-alert" style={{ marginTop: 16 }}>Payment instructions are being set up. Check back after Titonova adds the price and account details.</div>}
      </section>

      <section className="dashboard-card">
        <div className="eyebrow">Submit a payment</div><h2 style={{ margin: "6px 0" }}>Send proof for review</h2>
        <p style={{ color: "var(--muted)", fontSize: 12 }}>{settings?.premium_price_npr ? <><strong>Amount due: {amount(settings.premium_price_npr)}.</strong> Pay this amount exactly. Your request records it with the current plan length.</> : "The amount due will appear here after Premium is configured."}</p>
        {hasPending ? <div className="setup-alert">One payment request is already waiting for admin review. You can submit another after it is reviewed.</div> : paymentReady && summary ? <form action={submitEmployerPayment} className="auth-form" encType="multipart/form-data">
          <label htmlFor="payment_method">Payment method</label><select id="payment_method" name="payment_method" required defaultValue=""><option value="" disabled>Choose a method</option>{methods.map((method) => <option key={method.id} value={method.id}>{method.name}</option>)}</select>
          <label htmlFor="transaction_code">Transaction code</label><input id="transaction_code" name="transaction_code" minLength={4} maxLength={120} required placeholder="Enter the payment reference" />
          <label htmlFor="proof">Payment proof (image or PDF, up to 5 MB)</label><input id="proof" name="proof" type="file" accept="image/jpeg,image/png,image/webp,application/pdf" required />
          <button className="button full" type="submit">Submit payment proof →</button>
        </form> : <p style={{ color: "var(--muted)", fontSize: 12 }}>Payment submission is unavailable until payment settings and your history can be loaded.</p>}
        {isPremium && <p className="auth-footer"><Link href="/dashboard/jobs/new">Post a job →</Link></p>}
      </section>
    </div>

    <section style={{ marginTop: 30 }}><div className="admin-section-heading"><div><div className="eyebrow">Payment history</div><h2 style={{ margin: "5px 0" }}>Your requests</h2></div></div>
      {requestsError ? <div className="form-alert">Payment history could not be loaded.</div> : !requests?.length ? <section className="dashboard-card"><p style={{ margin: 0, color: "var(--muted)", fontSize: 12 }}>No payment requests yet.</p></section> : <div className="portal-table"><table><thead><tr><th>Submitted</th><th>Method</th><th>Amount</th><th>Transaction code</th><th>Status</th><th>Admin note</th></tr></thead><tbody>{requests.map((request) => <tr key={request.id}><td>{date(request.created_at)}</td><td>{request.payment_method}</td><td>{amount(request.amount_npr)} / {request.plan_duration_days} days</td><td>{request.transaction_code}</td><td><span className={`status-tag status-${request.status}`}>{request.status}</span></td><td>{request.review_note || "—"}</td></tr>)}</tbody></table></div>}
      {!requestsError && <nav className="admin-pagination" aria-label="Payment history pages">{page>1&&<Link href={`/dashboard/billing?page=${page-1}`}>← Previous</Link>}<span>Page {page} of {Math.max(1,Math.ceil((requestCount??0)/10))}</span>{page*10<(requestCount??0)&&<Link href={`/dashboard/billing?page=${page+1}`}>Next →</Link>}</nav>}
    </section>
  </PortalShell>;
}
