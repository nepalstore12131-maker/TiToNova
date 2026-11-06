import {Money} from "@/components/currency-display";
import {nextPostSource,type PostAllowance} from "@/lib/posting-plan";
import {LabelIcon} from "@/components/workspace-ui";
import {PaymentMethod,PaymentMethodOptions} from "@/components/payment-method";
import {UiIcon} from "@/components/workspace-ui";
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
const amount = (value:number) => <Money amount={value}/>;
const paymentErrors: Record<string, string> = {
  invalid: "Enter a transaction code and upload a JPG, PNG, WebP, or PDF proof file no larger than 5 MB.",
  "not-ready": "The offer is unavailable or its price changed. Check the current price before submitting.",
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
  const [{ data: settings, error: settingsError }, { data: requests, error: requestsError, count: requestCount }, summary, allowanceResult] = await Promise.all([
    supabase.from("employer_payment_settings").select("*").eq("id", 1).maybeSingle(),
    supabase.from("employer_payment_requests").select("id,product,payment_method,transaction_code,amount_npr,plan_duration_days,status,review_note,created_at,reviewed_at",{count:"exact"}).eq("employer_id", user.id).order("created_at", { ascending: false }).range((page-1)*10,page*10-1),
    loadPaymentSummary(supabase,user.id), supabase.rpc("post_allowance").single(),
  ]);
  const errorKey = one(params.error);
  const success = one(params.success);
  const isPremium = Boolean(profile.employer_premium_until && new Date(profile.employer_premium_until).getTime() > Date.now());
  const allowance = allowanceResult.data as PostAllowance|null;
  const post = one(params.plan)==="post";
  const checkoutUrl = post ? settings?.single_checkout_url : settings?.premium_checkout_url;
  const price = post ? settings?.single_post_npr : settings?.premium_price_npr;
  const duration = post ? 1 : settings?.premium_duration_days;
  const methods = [
    {id:"international",name:"International checkout",available:Boolean(checkoutUrl)},
    { id: "esewa", name: "eSewa", available: Boolean(settings?.esewa_account_id) },
    { id: "khalti", name: "Khalti", available: Boolean(settings?.khalti_account_id || settings?.khalti_payment_url) },
    { id: "bank", name: "Bank transfer", available: Boolean(settings?.bank_name && settings?.bank_account_number) },
  ].filter((method) => method.available);
  const freeOffer = !post && !settingsError && settings?.premium_price_npr === 0;
  const paymentReady = !settingsError && Boolean(settings && price > 0 && methods.length);
  const hasPending = (summary?.pendingCount ?? 0) > 0;

  return <PortalShell role="employer" activePath="/dashboard/billing">
    <div className="eyebrow">Employer workspace</div><h1>Payments &amp; billing</h1>
    <section className="dashboard-card"><h2>Posting options</h2>
      {allowance && <p>{allowance.free_left} free posts remaining · {allowance.credits_left} prepaid posts available{allowance.premium_active && allowance.premium_left!==null ? ` · ${allowance.premium_left} Premium posts remaining this month` : ""}</p>}
      {nextPostSource(allowance)&&<Link className="button" href="/dashboard/jobs/new">Post a job</Link>}
      <nav aria-label="Choose posting plan" className="filter-actions">{settings?.single_post_npr>0&&<Link className="button secondary" href="?plan=post">One post · {amount(settings.single_post_npr)}</Link>}
      <Link className="button secondary" href="?plan=premium">Premium · {settings ? amount(settings.premium_price_npr) : "See price"} / {settings?.premium_duration_days||30} days</Link></nav>
    </section>
    <details className="dashboard-card"><summary>Payment totals</summary><PaymentOverview summary={summary}/></details><section className="dashboard-card premium-status-card">
      <div><div className="detail-label" style={{ marginTop: 0 }}>Account status</div><h2 style={{ margin: "4px 0 6px" }}>{isPremium ? "Premium active" : "Free plan"}</h2><p style={{ margin: 0, color: "var(--muted)", fontSize: 12 }}>{isPremium ? `Access through ${date(profile.employer_premium_until)}.` : "Free account"}</p></div>
      {isPremium && <span className="status-tag status-published">Eligible to post</span>}
    </section>

    {success === "submitted" && <div className="setup-alert" style={{ marginTop: 16 }}>Your payment proof was sent. An administrator will review it before granting the purchased access.</div>}
    {errorKey && <div className="form-alert" style={{ marginTop: 16 }} role="alert">{paymentErrors[errorKey] || "We couldn’t submit your payment proof. Please try again."}</div>}

    {freeOffer?<section className="dashboard-card"><h2 className="icon-title"><UiIcon name="spark"/>Free Premium offer</h2><p>No payment or proof is needed. Send a request to the Titonova team; access starts after approval.</p><Link className="button" href="/dashboard/support?premium=1"><UiIcon name="shield" size={17}/>Request Premium access</Link></section>:<details open={post||!isPremium||!!errorKey||hasPending} className="dashboard-card"><summary>{post?"Buy one job post":"Premium payment"}</summary><div className="billing-grid">
      <section className="dashboard-card">
        <div className="eyebrow">1. Check price & pay</div><h2 style={{ margin: "6px 0" }}>{price ? amount(price) : "Price not set"}</h2>
        <p style={{ color: "var(--muted)", fontSize: 12, marginTop: 0 }}>{post?"One posting credit after approval":`${duration || 30} days of Premium after approval`}</p>
        {checkoutUrl && <a className="button secondary" href={checkoutUrl} target="_blank" rel="noopener noreferrer">Open international checkout</a>}
        {settings?.payment_instructions && <p className="admin-content-copy">{settings.payment_instructions}</p>}
        {settings?.esewa_account_id && <div className="payment-detail"><PaymentMethod method="esewa"/><span>{settings.esewa_account_name || "Account"} · {settings.esewa_account_id}</span></div>}
        {(settings?.khalti_account_id || settings?.khalti_payment_url) && <div className="payment-detail"><PaymentMethod method="khalti"/><span>{settings.khalti_account_name || "Account"}{settings.khalti_account_id ? ` · ${settings.khalti_account_id}` : ""}</span>{settings.khalti_payment_url && <a href={settings.khalti_payment_url} target="_blank" rel="noreferrer">Open Khalti payment link ↗</a>}</div>}
        {settings?.bank_name && settings?.bank_account_number && <div className="payment-detail"><PaymentMethod method="bank"/><strong>{settings.bank_name}</strong><span>{settings.bank_account_name || "Account holder"} · {settings.bank_account_number}</span></div>}
        {!paymentReady && <div className="setup-alert" style={{ marginTop: 16 }}>Payment instructions are being set up. Check back after Titonova adds the price and account details.</div>}
      </section>

      <section className="dashboard-card">
        <div className="eyebrow">2. Send payment proof</div><h2 style={{ margin: "6px 0" }}>Send proof for review</h2>
        <p style={{ color: "var(--muted)", fontSize: 12 }}>{price ? <><strong>Amount due: {amount(price)}.</strong> Pay this amount exactly. Your request records the selected purchase.</> : "The amount due will appear here after Premium is configured."}</p>
        {hasPending ? <div className="setup-alert">One payment request is already waiting for admin review. You can submit another after it is reviewed.</div> : paymentReady && summary ? <form action={submitEmployerPayment} className="auth-form" encType="multipart/form-data">
          <input type="hidden" name="product" value={post?"post":"premium"}/><input type="hidden" name="quoted_price" value={price}/><input type="hidden" name="quoted_duration" value={duration}/>
          <PaymentMethodOptions name="payment_method" methods={methods.map(m=>m.id)}/>
          <label htmlFor="transaction_code">Transaction code</label><input id="transaction_code" name="transaction_code" minLength={4} maxLength={120} required placeholder="Enter the payment reference" />
          <label htmlFor="proof">Payment proof (image or PDF, up to 5 MB)</label><input id="proof" name="proof" type="file" accept="image/jpeg,image/png,image/webp,application/pdf" required />
          <button className="button full" type="submit"><LabelIcon label='Submit payment proof →'/>Submit payment proof →</button>
        </form> : <p style={{ color: "var(--muted)", fontSize: 12 }}>Payment submission is unavailable until payment settings and your history can be loaded.</p>}
        {isPremium && <p className="auth-footer"><Link href="/dashboard/jobs/new">Post a job →</Link></p>}
      </section>
    </div></details>}

    <details open={page>1||hasPending||!!success} style={{ marginTop: 30 }}><summary>Payment requests & history</summary><section><div className="admin-section-heading"><div><div className="eyebrow">Payment history</div><h2 style={{ margin: "5px 0" }}>Your requests</h2></div></div>
      {requestsError ? <div className="form-alert">Payment history could not be loaded.</div> : !requests?.length ? <section className="dashboard-card"><p style={{ margin: 0, color: "var(--muted)", fontSize: 12 }}>No payment requests yet.</p></section> : <div className="portal-table"><table><thead><tr><th>Submitted</th><th>Method</th><th>Amount</th><th>Transaction code</th><th>Status</th><th>Admin note</th></tr></thead><tbody>{requests.map((request) => <tr key={request.id}><td>{date(request.created_at)}</td><td><PaymentMethod method={request.payment_method}/></td><td>{amount(request.amount_npr)} / {request.product==="post"?"one post":`${request.plan_duration_days} days`}</td><td>{request.transaction_code}</td><td><span className={`status-tag status-${request.status}`}>{request.status}</span></td><td>{request.review_note || "—"}</td></tr>)}</tbody></table></div>}
      {!requestsError && <nav className="admin-pagination" aria-label="Payment history pages">{page>1&&<Link href={`/dashboard/billing?page=${page-1}`}>← Previous</Link>}<span>Page {page} of {Math.max(1,Math.ceil((requestCount??0)/10))}</span>{page*10<(requestCount??0)&&<Link href={`/dashboard/billing?page=${page+1}`}>Next →</Link>}</nav>}
    </section></details>
  </PortalShell>;
}
