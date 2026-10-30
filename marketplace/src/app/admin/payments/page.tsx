import {loadPaymentSummary} from "@/lib/payment-summary";
import {PaymentOverview} from "@/components/payment-overview";
import Link from "next/link";
import { reviewEmployerPayment, setEmployerPremiumAccess } from "@/app/admin/payment-actions";
import { PortalShell } from "@/components/portal-shell";
import { requireAdminContext } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };
const one = (value: string | string[] | undefined) => Array.isArray(value) ? value[0] ?? "" : value ?? "";
const date = (value?: string | null) => value ? new Date(value).toLocaleString("en-NP", { dateStyle: "medium", timeStyle: "short" }) : "Never";
const amount = (value: number) => `NPR ${value.toLocaleString("en-NP")}`;
const methodName: Record<string, string> = { esewa: "eSewa", khalti: "Khalti", bank: "Bank transfer" };

export default async function AdminPaymentsPage({ searchParams }: Props) {
  const { sessionClient } = await requireAdminContext();
  const summary = await loadPaymentSummary(sessionClient);
  const params = await searchParams;
  const requestedStatus = one(params.status);
  const status = ["pending", "approved", "rejected", "all"].includes(requestedStatus) ? requestedStatus : "pending";
  const paymentPage = Math.max(1, Math.min(10000, Number.parseInt(one(params.payment_page) || "1", 10) || 1));
  const accountPage = Math.max(1, Math.min(10000, Number.parseInt(one(params.account_page) || "1", 10) || 1));
  const pageSize = 30;
  let requestQuery = sessionClient.from("employer_payment_requests").select("id,employer_id,payment_method,transaction_code,amount_npr,plan_duration_days,proof_path,status,review_note,reviewed_at,reviewed_by,created_at,employer:profiles!employer_payment_requests_employer_id_fkey(id,full_name,company_name,employer_premium_until),reviewer:profiles!employer_payment_requests_reviewed_by_fkey(full_name)", { count: "exact" }).order("created_at", { ascending: false }).range((paymentPage - 1) * pageSize, paymentPage * pageSize - 1);
  if (status !== "all") requestQuery = requestQuery.eq("status", status);
  const [{ data: requests, count: requestCount, error: requestError }, { data: employers, count: employerCount, error: employerError }, { data: settings }] = await Promise.all([
    requestQuery,
    sessionClient.from("profiles").select("id,full_name,company_name,employer_premium_until,created_at", { count: "exact" }).eq("role", "employer").order("created_at", { ascending: false }).range((accountPage - 1) * pageSize, accountPage * pageSize - 1),
    sessionClient.from("employer_payment_settings").select("premium_price_npr,premium_duration_days").eq("id", 1).maybeSingle(),
  ]);
  const withProof = await Promise.all((requests ?? []).map(async (request) => {
    const { data } = await sessionClient.storage.from("employer-payment-proofs").createSignedUrl(request.proof_path, 60 * 60);
    return { ...request, proofUrl: data?.signedUrl ?? "" };
  }));
  const success = one(params.success);
  const errorKey = one(params.error);

  return <PortalShell role="admin" activePath="/admin/payments">
    <div className="eyebrow">Billing administration</div><div className="portal-toolbar"><div><h1>Revenue &amp; payments</h1><p style={{ color: "var(--muted)", fontSize: 13 }}>Review transaction references and private proof files. Approving a payment activates the employer’s plan for the duration recorded on that request.</p></div><Link className="button secondary" href="/admin/payments/settings">Plan and account settings →</Link></div>
    <PaymentOverview summary={summary} admin/>
    {success && <div className="setup-alert" style={{ marginTop: 16 }}>{({ approved: "Payment approved and Premium access activated.", rejected: "Payment rejected.", "access-extended": "Premium access extended.", "access-revoked": "Premium access disabled." } as Record<string, string>)[success] || "Payment settings updated."}</div>}
    {errorKey && <div className="form-alert" style={{ marginTop: 16 }}>{errorKey === "invalid" ? "Choose a valid request and action." : errorKey === "account" ? "Employer access could not be changed." : "The payment could not be updated. It may already have been reviewed."}</div>}
    <nav className="admin-view-tabs" aria-label="Payment status">{(["pending", "approved", "rejected", "all"] as const).map((value) => <Link key={value} className={status === value ? "active" : ""} href={`/admin/payments?status=${value}`}>{value[0].toUpperCase() + value.slice(1)}</Link>)}</nav>
    {requestError ? <div className="form-alert">Payment requests could not be loaded. Apply the employer Premium database update and refresh.</div> : !withProof.length ? <section className="dashboard-card"><h2 style={{ marginTop: 0 }}>No {status === "all" ? "payment" : status} requests</h2><p style={{ color: "var(--muted)", fontSize: 13 }}>Employer payment submissions will appear here.</p></section> : <div className="admin-account-list">
      {withProof.map((request) => {
        const employer = Array.isArray(request.employer) ? request.employer[0] : request.employer;
        const reviewer = Array.isArray(request.reviewer) ? request.reviewer[0] : request.reviewer;
        const active = Boolean(employer?.employer_premium_until && new Date(employer.employer_premium_until).getTime() > Date.now());
        return <article className="dashboard-card admin-member-card" key={request.id}>
          <div className="admin-member-heading"><div><strong>{employer?.company_name || employer?.full_name || "Employer account"}</strong><span>{employer?.full_name || "Member"} · Submitted {date(request.created_at)}</span></div><span className={`status-tag status-${request.status}`}>{request.status}</span></div>
          <div className="payment-review-grid"><div><small>Payment method</small><strong>{methodName[request.payment_method] || request.payment_method}</strong></div><div><small>Amount and plan</small><strong>{amount(request.amount_npr)} · {request.plan_duration_days} days</strong></div><div><small>Transaction code</small><strong>{request.transaction_code}</strong></div><div><small>Account Premium access</small><strong>{active ? `Active through ${date(employer?.employer_premium_until)}` : "Not active"}</strong></div></div>
          {request.proofUrl ? <p className="admin-member-meta"><a href={request.proofUrl} target="_blank" rel="noreferrer">Open private payment proof ↗</a> · Link expires in one hour</p> : <p className="form-alert">Payment proof is unavailable. Check the private storage bucket and its access policy.</p>}
          {request.reviewed_at && <p className="admin-member-meta">Reviewed {date(request.reviewed_at)} by {reviewer?.full_name || "an administrator"}</p>}
          {request.review_note && <p className="admin-content-copy">Admin note: {request.review_note}</p>}
          {request.status === "pending" && <form action={reviewEmployerPayment} className="auth-form payment-review-form"><input type="hidden" name="payment_request_id" value={request.id} /><label htmlFor={`review-note-${request.id}`}>Admin note (optional)</label><textarea className="cover-note" id={`review-note-${request.id}`} name="review_note" maxLength={1000} placeholder="Add a note for the employer" /><div className="review-buttons"><button className="button small" name="decision" value="approved" type="submit">Approve payment and activate →</button><button className="button small danger" name="decision" value="rejected" type="submit">Reject</button></div></form>}
        </article>;
      })}
    </div>}
    <nav className="admin-pagination" aria-label="Payment request pages">{paymentPage > 1 && <Link className="button secondary small" href={`/admin/payments?status=${status}&payment_page=${paymentPage - 1}`}>← Previous payments</Link>}<span>Payments page {paymentPage} of {Math.max(1, Math.ceil((requestCount ?? 0) / pageSize))}</span>{paymentPage < Math.max(1, Math.ceil((requestCount ?? 0) / pageSize)) && <Link className="button secondary small" href={`/admin/payments?status=${status}&payment_page=${paymentPage + 1}`}>Next payments →</Link>}</nav>

    <section style={{ marginTop: 34 }}><div className="eyebrow">Employer account status</div><h2 style={{ margin: "5px 0" }}>Premium access controls</h2><p style={{ color: "var(--muted)", fontSize: 12 }}>Admins can manually extend or disable access. Extending uses the current plan duration and does not edit payment history.</p>
      {employerError ? <div className="form-alert">Employer accounts could not be loaded.</div> : !employers?.length ? <section className="dashboard-card"><p style={{ margin: 0, color: "var(--muted)", fontSize: 12 }}>No employer accounts yet.</p></section> : <div className="admin-account-list">{employers.map((employer) => {
        const active = Boolean(employer.employer_premium_until && new Date(employer.employer_premium_until).getTime() > Date.now());
        return <article className="dashboard-card admin-member-card" key={employer.id}><div className="admin-member-heading"><div><strong>{employer.company_name || employer.full_name || "Employer"}</strong><span>{employer.full_name} · {active ? `Active through ${date(employer.employer_premium_until)}` : "Premium inactive"}</span></div><span className={`status-tag ${active ? "status-approved" : "status-rejected"}`}>{active ? "Eligible to post" : "Not eligible"}</span></div><form action={setEmployerPremiumAccess} className="admin-inline-form"><input type="hidden" name="employer_id" value={employer.id} /><button className="button small" name="access_action" value="extend" type="submit">Extend {settings?.premium_duration_days ?? 30} days</button>{active && <button className="button small danger" name="access_action" value="revoke" type="submit">Disable Premium</button>}</form></article>;
      })}</div>}
      <nav className="admin-pagination" aria-label="Employer account pages">{accountPage > 1 && <Link className="button secondary small" href={`/admin/payments?status=${status}&payment_page=${paymentPage}&account_page=${accountPage - 1}`}>← Previous accounts</Link>}<span>Accounts page {accountPage} of {Math.max(1, Math.ceil((employerCount ?? 0) / pageSize))}</span>{accountPage < Math.max(1, Math.ceil((employerCount ?? 0) / pageSize)) && <Link className="button secondary small" href={`/admin/payments?status=${status}&payment_page=${paymentPage}&account_page=${accountPage + 1}`}>Next accounts →</Link>}</nav>
    </section>
  </PortalShell>;
}
