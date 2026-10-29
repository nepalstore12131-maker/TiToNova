export const experienceLevels = ["any", "entry", "mid", "senior"] as const;
export const workModes = ["onsite", "hybrid", "remote"] as const;
export const categories = ["Design & creative", "Development", "Marketing", "Writing & content", "Business support", "Other"];
export function skillMatches(job: {title:string;description:string;category:string}, skills:string[]): string[] {
  const text = ` ${job.title} ${job.description} ${job.category} `.toLocaleLowerCase();
  return skills.filter(skill => {
    const normalized=skill.trim().toLocaleLowerCase();
    if (!normalized) return false;
    const escaped=normalized.replace(/[.*+?^${}()|[\]\\]/g,"\\$&");
    return new RegExp(`(^|[^\\p{L}\\p{N}])${escaped}($|[^\\p{L}\\p{N}])`,"u").test(text);
  });
}
export function formatNpr(min:number|null,max:number|null,ne=false,currency="NPR") {
  if(min===null&&max===null) return ne?"पारिश्रमिक छलफलमा":"Salary to discuss";
  const f=(n:number)=>new Intl.NumberFormat(ne?"ne-NP":"en-NP").format(n);
  const unit=currency==="NPR"?(ne?"रु.":"NPR"):currency;
  return `${unit} ${min===null?"—":f(min)}${max===null?"+":`–${f(max)}`}`;
}
