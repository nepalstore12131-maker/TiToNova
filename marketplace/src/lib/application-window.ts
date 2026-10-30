export type ApplicationWindow={applications_open_at?:string|null;applications_close_at?:string|null;urgent?:boolean};
export function applicationAvailability(job:ApplicationWindow,now=Date.now()){
 if(job.applications_close_at&&Date.parse(job.applications_close_at)<=now)return 'closed';
 if(job.applications_open_at&&Date.parse(job.applications_open_at)>now)return 'scheduled';
 return 'open';
}
export function parseNepalDate(value:string){if(!value)return null;if(!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value))throw Error('Invalid date');const d=new Date(value+'+05:45');if(!Number.isFinite(d.getTime())||nepalDateInput(d.toISOString())!==value)throw Error('Invalid date');return d.toISOString();}
export function nepalDateInput(value?:string|null){return value?new Date(Date.parse(value)+345*60000).toISOString().slice(0,16):'';}
