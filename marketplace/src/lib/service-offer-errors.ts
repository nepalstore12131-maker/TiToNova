export function offerErrorCode(message:string){
 if(/current schedule|future times/i.test(message))return 'dates';
 if(/Premium|account access/i.test(message))return 'access';
 if(/Offer changed|no longer available/i.test(message))return 'changed';
 if(/Only the named worker/i.test(message))return 'worker';
 if(/check constraint|invalid input|out of range/i.test(message))return 'fields';
 return 'error';
}
export const offerErrorMessages:Record<string,string>={
 consent:'Tick the confirmation box after reviewing the work and payment terms.',
 dates:'The start must be in the future (Nepal time). A deadline needs a start and must be later. Leave both blank for flexible timing.',
 fields:'Check the title (4–120 characters), work description (30–6,000), payment terms (5–2,000), time arrangement (3–1,000) and a whole-rupee amount from NPR 1 to 100,000,000.',
 access:'This request needs an active, unrestricted employer Premium account and an unrestricted worker account. The employer should check Premium & billing; contact support if Premium is already active.',
 changed:'This proposal has changed, was already answered, or its conversation is closed. Refresh and use the latest proposal.',
 worker:'Only the worker named in this service request can accept or decline this proposal.',
 error:'The proposal could not be saved. Your work has not started. Try again; if this continues, send this request page link to support.',
};
