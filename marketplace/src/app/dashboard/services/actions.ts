"use server";
import {redirect} from 'next/navigation';

// Stale forms must not create or change service requests or agreements.
export async function serviceAction(_form:FormData){
 redirect('/dashboard/work');
}
