export const notificationSections = {
 applications: '/dashboard/applications',
 work: '/dashboard/work',
} as const;
export function sectionPath(section: string) {
 return Object.prototype.hasOwnProperty.call(notificationSections,section)?notificationSections[section as keyof typeof notificationSections]:null;
}
export function validSeenTime(value:string,now=Date.now()) {
 const time=Date.parse(value);
 return Number.isFinite(time)&&time<=now&&time>now-86400000;
}
