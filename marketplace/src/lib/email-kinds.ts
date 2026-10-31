export const emailKinds = [
 ['job_alert','Matching new jobs'],['invitation','Hiring invitations and replies'],
 ['application','Applications and hiring updates'],['message','Application messages'],
 ['interview','Interviews'],['work','Work, agreements and delivery'],
 ['service','Service requests and replies'],['payment','Premium payment updates'],
 ['promotion','Job promotion updates'],['advertising','Banner advertising updates'],
 ['listing','Listing reviews'],['review','Ratings and feedback'],
 ['support','Support, disputes and account restrictions'],['moderation','Moderation updates'],
 ['announcement','Titonova notices'],
] as const;
export const emailKindKeys=emailKinds.map(([key])=>key);
export function safeNotificationHref(value:string){return /^\/(dashboard\/|jobs\/)[^\\\s]*$/.test(value)?value:'/dashboard/notifications';}
