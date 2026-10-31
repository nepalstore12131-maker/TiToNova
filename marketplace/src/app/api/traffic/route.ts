import {createClient} from '@supabase/supabase-js';
import {trafficPages,trafficSources} from '@/lib/traffic';
export const dynamic='force-dynamic';
export async function POST(request:Request){
 const headers={'Cache-Control':'no-store'};
 const origin=request.headers.get('origin');
 if(!origin||!['https://www.titonova.com','https://titonova.com','https://titonova.vercel.app'].includes(origin))return new Response(null,{status:403,headers});
 if(request.headers.get('dnt')==='1'||request.headers.get('sec-gpc')==='1')return new Response(null,{status:204,headers});
 if(/bot|crawler|spider|headless/i.test(request.headers.get('user-agent')||''))return new Response(null,{status:204,headers});
 if(Number(request.headers.get('content-length')||0)>700)return new Response(null,{status:413,headers});
 const reader=request.body?.getReader();if(!reader)return new Response(null,{status:400,headers});
 let text='';const decoder=new TextDecoder();let size=0;while(true){const chunk=await reader.read();if(chunk.done)break;size+=chunk.value.length;if(size>700){await reader.cancel();return new Response(null,{status:413,headers});}text+=decoder.decode(chunk.value,{stream:true});}text+=decoder.decode();
 let body;try{body=JSON.parse(text);}catch{return new Response(null,{status:400,headers});}
 const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
 if(!body||!uuid.test(body.event)||!uuid.test(body.session)||!trafficPages.includes(body.page)||!trafficSources.includes(body.source))return new Response(null,{status:400,headers});
 const url=process.env.NEXT_PUBLIC_SUPABASE_URL,key=process.env.SUPABASE_SERVICE_ROLE_KEY;
 if(!url||!key)return new Response(null,{status:503,headers});
 const db=createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false}});
 const {error}=await db.rpc('record_site_visit',{p_event:body.event,p_session:body.session,p_page:body.page,p_source:body.source});
 return new Response(null,{status:error?503:204,headers});
}
