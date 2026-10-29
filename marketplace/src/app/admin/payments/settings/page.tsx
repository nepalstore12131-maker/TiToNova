import Link from "next/link";
import { saveEmployerPaymentSettings } from "@/app/admin/payment-actions";
import { PortalShell } from "@/components/portal-shell";
import { requireAdminContext } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };
const one = (value: string | string[] | undefined) => Array.isArray(value) ? value[0] ?? "" : value ?? "";

export default async function AdminPaymentSettingsPage({ searchParams }: Props) {
  const { sessionClient } = await requireAdminContext();
  const [{ data: settings }, params] = await Promise.all([
    sessionClient.from("employer_payment_settings").select("*").eq("id", 1).maybeSingle(),
    searchParams,
  ]);
  const success = one(params.success);
  const error = one(params.error);
  const value = settings ?? {
    premium_price_npr: 0,
    premium_duration_days: 30,
    payment_instructions: "",
    esewa_account_name: "",
    esewa_account_id: "",
    khalti_account_name: "",
    khalti_account_id: "",
    khalti_payment_url: "",
    bank_name: "",
    bank_account_name: "",
    bank_account_number: "",
  };

  return <PortalShell role="admin" activePath="/admin/payments/settings">
    <p style={{ margin: "0 0 18px", fontSize: 12 }}><Link href="/admin/payments" style={{ color: "var(--green)" }}>← Payments and access</Link></p>
    <div className="eyebrow">Premium plan setup</div><h1>Payment settings</h1>
    <p style={{ color: "var(--muted)", fontSize: 13 }}>Set the exact price employers must pay, how many days access lasts, and which payment details appear on their billing page. Changes apply to new payment requests.</p>
    {success === "saved" && <div className="setup-alert" style={{ marginTop: 16 }}>Premium price and payment details saved.</div>}
    {error && <div className="form-alert" style={{ marginTop: 16 }}>{error === "invalid" ? "Enter a valid price, duration, and secure Khalti link." : "Settings could not be saved. Check the values and try again."}</div>}
    <section className="dashboard-card">
      <form action={saveEmployerPaymentSettings} className="auth-form">
        <div className="pay-fields"><div><label htmlFor="premium_price_npr">Premium price (NPR)</label><input id="premium_price_npr" name="premium_price_npr" type="number" min="0" max="100000000" step="1" defaultValue={value.premium_price_npr} required /><small className="field-help">This is the exact amount shown to employers. Use 0 to keep payments disabled until ready.</small></div><div><label htmlFor="premium_duration_days">Access duration (days)</label><input id="premium_duration_days" name="premium_duration_days" type="number" min="1" max="365" step="1" defaultValue={value.premium_duration_days} required /></div></div>
        <label htmlFor="payment_instructions">Payment instructions (optional)</label><textarea className="cover-note" id="payment_instructions" name="payment_instructions" maxLength={1500} defaultValue={value.payment_instructions} placeholder="For example: Please pay the exact amount, then submit your transaction code and a screenshot." />
        <h2 className="payment-settings-heading">eSewa account</h2>
        <div className="pay-fields"><div><label htmlFor="esewa_account_name">Account name</label><input id="esewa_account_name" name="esewa_account_name" maxLength={120} defaultValue={value.esewa_account_name} /></div><div><label htmlFor="esewa_account_id">eSewa ID or phone number</label><input id="esewa_account_id" name="esewa_account_id" maxLength={120} defaultValue={value.esewa_account_id} /></div></div>
        <h2 className="payment-settings-heading">Khalti account</h2>
        <label htmlFor="khalti_account_name">Account name</label><input id="khalti_account_name" name="khalti_account_name" maxLength={120} defaultValue={value.khalti_account_name} />
        <div className="pay-fields"><div><label htmlFor="khalti_account_id">Khalti ID or account number</label><input id="khalti_account_id" name="khalti_account_id" maxLength={120} defaultValue={value.khalti_account_id} /></div><div><label htmlFor="khalti_payment_url">Khalti payment link (optional)</label><input id="khalti_payment_url" name="khalti_payment_url" type="url" maxLength={500} defaultValue={value.khalti_payment_url} placeholder="https://…" /></div></div>
        <h2 className="payment-settings-heading">Bank transfer</h2>
        <label htmlFor="bank_name">Bank name</label><input id="bank_name" name="bank_name" maxLength={120} defaultValue={value.bank_name} />
        <div className="pay-fields"><div><label htmlFor="bank_account_name">Account holder</label><input id="bank_account_name" name="bank_account_name" maxLength={120} defaultValue={value.bank_account_name} /></div><div><label htmlFor="bank_account_number">Account number</label><input id="bank_account_number" name="bank_account_number" maxLength={120} defaultValue={value.bank_account_number} /></div></div>
        <button className="button" type="submit">Save payment settings →</button>
      </form>
    </section>
  </PortalShell>;
}
