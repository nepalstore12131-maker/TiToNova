"use server";
import {redirect} from "next/navigation";
import {requireAdminContext} from "@/lib/supabase/admin";
export async function saveControls(form:FormData){
 const {sessionClient:db}=await requireAdminContext();
 const {data:s,error:loadError}=await db.from('marketplace_controls').select('*').eq('id',true).single();
 if(loadError||!s)redirect('/admin/settings?error=unavailable');
 const retention=form.get('section')==='retention';
 const version=Number(form.get('version'));const hours=retention?Number(form.get('hours')):s.support_retention_hours;
 const threshold=retention?s.report_threshold:Number(form.get('threshold'));
 if(!Number.isInteger(version)||!Number.isInteger(hours)||hours<1||hours>720||!Number.isInteger(threshold)||threshold<2||threshold>100)redirect('/admin/settings?error=invalid');
 if(retention&&form.get('confirmation')!=='CONFIRM')redirect('/admin/settings?error=confirm');
 const {error}=await db.rpc('save_marketplace_controls',{p_version:version,p_review:retention?s.require_job_review:form.get('review')==='on',p_threshold:threshold,p_notify:retention?s.moderation_notifications:form.get('notify')==='on',p_cleanup:retention?form.get('enabled')==='true':s.support_cleanup_enabled,p_hours:hours,p_confirm_cleanup:retention});
 if(error)redirect(`/admin/settings?error=${error.message.includes('settings_stale')?'stale':'save'}`);
 redirect('/admin/settings?success=saved');
}
