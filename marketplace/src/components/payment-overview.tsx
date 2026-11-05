import {UiIcon} from "./workspace-ui";
import {formatNpr,type PaymentSummary} from '@/lib/payment-summary';
export function PaymentOverview({summary,admin=false}:{summary:PaymentSummary|null;admin?:boolean}){
 if(!summary)return <div className="form-alert" role="alert">Payment totals could not be loaded. Please refresh; your recorded payments have not changed.</div>;
 return <><div className="money-metrics">
 <section className="dashboard-card"><span className="eyebrow icon-title"><UiIcon name="wallet"/>{admin?'Approved Premium payments':'Approved payments'}</span><h2>{formatNpr(summary.approved)}</h2><p>{summary.approvedCount} approved {summary.approvedCount===1?'payment':'payments'} · all time</p></section>
 <section className="dashboard-card"><span className="eyebrow icon-title"><UiIcon name="clock"/>Awaiting review</span><h2>{formatNpr(summary.pending)}</h2><p>{summary.pendingCount} pending {summary.pendingCount===1?'request':'requests'} · not approved yet</p></section>
 <section className="dashboard-card"><span className="eyebrow icon-title"><UiIcon name="close"/>Rejected requests</span><h2>{summary.rejectedCount}</h2><p>Excluded from approved payment totals</p></section>
 </div><p className="money-disclosure">{admin?'Totals reflect admin-approved Premium requests, not bank reconciliation, profit, or freelancer earnings. Manual access extensions do not count as payments.':'Totals cover your Employer Premium requests only. They do not include wages or payments to freelancers.'}</p></>;
}
