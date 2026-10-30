import {redirect} from 'next/navigation';
import {requireAdminContext} from '@/lib/supabase/admin';
export default async function Moderation(){await requireAdminContext();redirect('/admin/jobs');}
