export type FlowTone = 'waiting'|'action'|'success'|'danger'|'neutral';
export type FlowStep = {label:string;message:string;action:string;href:string;tone:FlowTone;step:number};
type Assignment={id:string;state:string;agreement_required?:boolean};
export function applicationStep(id:string,status:string,stage:string,employer:boolean,work?:Assignment|null):FlowStep {
 const href=`/dashboard/applications/${id}`;
 if(work){
  const url=work.state==='completed'||work.state==='cancelled'?`/dashboard/work?view=history#work-${work.id}`:`/dashboard/work#work-${work.id}`;
  if(work.state==='completed')return {label:'Completed',message:'Work is complete. Both sides can leave a rating.',action:'View completion & rating',href:url,tone:'success',step:4};
  if(work.state==='cancelled')return {label:'Cancelled',message:'This assignment ended. Its history is saved.',action:'View history',href:url,tone:'neutral',step:4};
  if(work.state==='submitted')return {label:'Submitted for review',message:employer?'Review the delivery, then confirm completion or request changes.':'Your work was submitted. Wait for the employer to review it.',action:employer?'Review delivery':'View submitted work',href:url,tone:employer?'action':'waiting',step:3};
  if(work.state==='in_progress')return {label:'In progress',message:employer?'The worker is doing the job. Follow progress in My work.':'Continue your job, then submit the completed work.',action:employer?'View work progress':'Continue my work',href:url,tone:'action',step:3};
  return {label:'Hired',message:employer?'Open My work to send or check the agreement. Work starts after the worker accepts.':'You have been selected. Open My work to review the agreement and see when you can start.',action:'Open agreement & next step',href:url,tone:'success',step:2};
 }
 if(status==='withdrawn')return {label:'Withdrawn',message:'This application was withdrawn.',action:'View application',href,tone:'neutral',step:0};
 if(status==='rejected'||stage==='rejected')return {label:'Not selected',message:employer?'This application was not selected.':'You were not selected for this job. You can explore other opportunities.',action:employer?'View application':'Find other jobs',href:employer?href:'/jobs',tone:'danger',step:1};
 if(stage==='hired')return {label:'Selected',message:'Check the application for the current assignment status.',action:'Check next step',href,tone:'success',step:2};
 if(stage==='interview')return {label:'Interview stage',message:'Open the application to check interview details and messages.',action:'View interview & messages',href:`${href}?step=interview`,tone:'action',step:1};
 if(status==='shortlisted'||stage==='shortlisted')return {label:'Shortlisted',message:employer?'Continue with this candidate. Talk if needed, then choose whether to assign the job.':'The employer shortlisted your application. Check messages for the next step.',action:employer?'Continue hiring':'View application & messages',href,tone:'success',step:1};
 return {label:employer?'New application':'Application sent',message:employer?'Review the candidate, talk if needed, then choose a worker.':'Your application has been sent. Wait for the employer’s response; you can check messages here.',action:employer?'Review applicant':'View application & messages',href,tone:employer?'action':'waiting',step:0};
}
