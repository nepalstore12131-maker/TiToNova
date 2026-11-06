export type PostAllowance = {free_left:number;credits_left:number;premium_left:number|null;premium_active:boolean};
export function nextPostSource(value: PostAllowance | null) {
  if (!value) return null;
  if (value.premium_active && (value.premium_left === null || value.premium_left > 0)) return "Premium";
  if (value.free_left > 0) return "Free allowance";
  if (value.credits_left > 0) return "One prepaid post";
  return null;
}
