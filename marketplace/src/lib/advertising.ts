export type AdPlan={id:string;name:string;placement:'home'|'jobs';daily_price_npr:number;max_days:number;width:number;height:number;max_mb:number;requirements:string;revision:string;active:boolean};
export const adTypes=['image/jpeg','image/png','image/webp'];
export function adDestination(value:string){try{const u=new URL(value);return u.protocol==='https:'&&!u.username&&!u.password&&!!u.hostname;}catch{return false;}}
