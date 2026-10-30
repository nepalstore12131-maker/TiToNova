export function sampleProvider(value:string):'Google Drive'|'YouTube'|null{
 try{const u=new URL(value);if(u.protocol!=='https:'||u.username||u.password||u.port||value.length>1000)return null;
 if(['drive.google.com','docs.google.com'].includes(u.hostname)&&u.pathname!=='/' )return 'Google Drive';
 if(['youtube.com','www.youtube.com','m.youtube.com'].includes(u.hostname)&&((u.pathname==='/watch'&&/^[\w-]{11}$/.test(u.searchParams.get('v')||''))||/^\/(shorts|embed)\/[\w-]{11}\/?$/.test(u.pathname)))return 'YouTube';
 if(u.hostname==='youtu.be'&&/^\/[\w-]{11}\/?$/.test(u.pathname))return 'YouTube';return null;
 }catch{return null;}
}
export function parseSamples(text:string){const links=[...new Set(text.split(/\r?\n/).map(x=>x.trim()).filter(Boolean))];if(text.length>3000||links.length>5||links.some(x=>!sampleProvider(x)))return null;return links;}
