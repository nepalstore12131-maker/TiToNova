import Link from "next/link";
import { notFound } from "next/navigation";
import { PortalShell } from "@/components/portal-shell";
import { requireAdminContext } from "@/lib/supabase/admin";
export const dynamic="force-dynamic";
export default async function ConversationReview({params,searchParams}:{params:Promise<{id:string}>;searchParams:Promise<{page?:string}>}) {
  const {sessionClient:db}=await requireAdminContext();
  const {id}=await params;
  if(!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const page=Math.max(1,Math.min(10000,parseInt((await searchParams).page||"1")||1));
  const {data:application}=await db.from("applications").select("id,status").eq("id",id).maybeSingle();
  if(!application)notFound();
  const {data:messages,error}=await db.from("application_messages").select("id,sender_id,body,created_at,hidden").eq("application_id",id).order("created_at",{ascending:false}).order("id",{ascending:false}).range((page-1)*50,page*50);
  return <PortalShell role="admin" activePath="/admin/messages"><Link href="/admin/messages">← Message reports</Link><div className="eyebrow" style={{marginTop:24}}>Moderation context</div><h1>Application conversation</h1><p className="field-help">Application {id} · {application.status}. Hidden messages remain visible to authorized moderators.</p>{error?<div className="form-alert">The conversation could not be loaded.</div>:<div className="conversation-thread">{!messages?.length&&<p>No messages in this conversation.</p>}{(messages||[]).slice(0,50).reverse().map(m=><article className="message-bubble" key={m.id}><div className="message-meta"><strong>{m.hidden?"Hidden message":"Visible message"}</strong><time>{new Date(m.created_at).toLocaleString("en-NP",{timeZone:"Asia/Kathmandu"})} NPT</time></div><p>{m.body}</p><small className="field-help">Sender: {m.sender_id}</small></article>)}</div>}<nav className="admin-pagination">{page>1&&<Link href={`?page=${page-1}`}>Newer messages</Link>}{(messages?.length||0)>50&&<Link href={`?page=${page+1}`}>Older messages</Link>}</nav></PortalShell>;
}
