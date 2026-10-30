'use server';
import {redirect} from 'next/navigation';
import {requireAdminContext} from '@/lib/supabase/admin';
export async function moderateReview(form:FormData){const {sessionClient:db}=await requireAdminContext();const {error}=await db.rpc('moderate_work_review',{p_review:String(form.get('review_id')||''),p_hidden:form.get('hidden')==='true',p_note:String(form.get('note')||'').trim()});redirect(`/admin/reviews?${error?'error=save':'success=saved'}`);}
