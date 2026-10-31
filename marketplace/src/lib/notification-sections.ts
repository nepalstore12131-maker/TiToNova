export const notificationSections = {
 applications:'/dashboard/applications',work:'/dashboard/work',interviews:'/dashboard/interviews',invitations:'/dashboard/invitations',
 reviews:'/dashboard/reviews',billing:'/dashboard/billing',promotions:'/dashboard/promotions',advertising:'/dashboard/advertising',
 jobs:'/dashboard/jobs',profile:'/dashboard/profile',settings:'/dashboard/settings',support:'/dashboard/support',disputes:'/dashboard/disputes',
} as const;
export type NotificationSection=keyof typeof notificationSections;
export function sectionPath(section:string){return Object.prototype.hasOwnProperty.call(notificationSections,section)?notificationSections[section as NotificationSection]:null;}
export function sectionForNotification(kind:string,href:string){
 if(kind==='message'||kind==='announcement')return null;
 if(kind==='review')return notificationSections.reviews;
 const path=href.split(/[?#]/)[0];return Object.values(notificationSections).find(base=>path===base||path.startsWith(base+'/'))||null;
}
export function validSeenTime(value:string,now=Date.now()){const time=Date.parse(value);return Number.isFinite(time)&&time<=now&&time>now-86400000;}
