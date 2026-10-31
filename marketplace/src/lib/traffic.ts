export const trafficPages = ['Home','Jobs','Job details','Services','Service details','Company profile','Signup','Login','Help','Contact','Workspace'] as const;
export const trafficSources = ['Direct / unknown','TikTok','Facebook','Instagram','Google','Other website'] as const;
export function trafficPage(path:string):string|null {
 if(path==='/'||path==='/ne')return 'Home';
 if(path==='/jobs')return 'Jobs';if(/^\/jobs\/[^/]+$/.test(path))return 'Job details';
 if(path==='/services')return 'Services';if(/^\/services\/[^/]+$/.test(path))return 'Service details';
 if(/^\/companies\/[^/]+$/.test(path))return 'Company profile';
 if(path==='/signup')return 'Signup';if(path==='/login'||path==='/employer/login')return 'Login';
 if(path==='/help')return 'Help';if(path==='/contact')return 'Contact';
 if(path==='/dashboard'||path.startsWith('/dashboard/'))return 'Workspace';
 return null;
}
export function trafficSource(referrer:string):string {
 try {const host=new URL(referrer).hostname.toLowerCase();const matches=(domain:string)=>host===domain||host.endsWith('.'+domain);
 if(matches('titonova.com')||matches('titonova.vercel.app'))return 'Direct / unknown';
 for(const [domain,label] of [['tiktok.com','TikTok'],['facebook.com','Facebook'],['instagram.com','Instagram'],['google.com','Google']])if(matches(domain))return label;
 return 'Other website';}catch{return 'Direct / unknown';}
}
export function growthLabel(current:number,previous:number):string {
 if(previous===0)return current===0?'No change':'New activity · no previous baseline';
 const change=(current-previous)/previous*100;return `${change>0?'+':''}${change.toFixed(1)}% vs previous period`;
}
