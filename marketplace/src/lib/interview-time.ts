export function nepalDateToIso(value:string):string|null{
 if(!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value))return null;
 const d=new Date(`${value}:00+05:45`);if(!Number.isFinite(d.getTime()))return null;
 if(new Date(d.getTime()+345*60000).toISOString().slice(0,16)!==value)return null;
 return d.toISOString();
}
export const formatInterview=(value:string)=>new Date(value).toLocaleString('en-NP',{timeZone:'Asia/Kathmandu',dateStyle:'full',timeStyle:'short'});
