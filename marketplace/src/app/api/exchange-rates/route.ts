import { getExchangeRates } from "@/lib/exchange-rates";
export async function GET() {
  const rates=await getExchangeRates();
  return Response.json(rates,{status:rates?200:503});
}
