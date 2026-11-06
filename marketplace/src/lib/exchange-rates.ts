import "server-only";
import { parseRates } from "./currency";
export async function getExchangeRates() {
  const today=new Intl.DateTimeFormat("en-CA",{timeZone:"Asia/Kathmandu",year:"numeric",month:"2-digit",day:"2-digit"}).format(new Date());
  const from=new Date(Date.parse(today)-7*86400000).toISOString().slice(0,10);
  try {
    const response=await fetch(`https://www.nrb.org.np/api/forex/v1/rates?page=1&per_page=100&from=${from}&to=${today}`,{next:{revalidate:3600},signal:AbortSignal.timeout(6000)});
    if(!response.ok) return null;
    return parseRates(await response.json(),today);
  } catch { return null; }
}
