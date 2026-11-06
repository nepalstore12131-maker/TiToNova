export const currencies = ["NPR","USD","INR","EUR","GBP","AUD","CAD","CHF","CNY","JPY","SGD","HKD","AED","SAR","QAR","KWD","BHD","MYR","KRW","THB","SEK","DKK"] as const;
export type Currency = typeof currencies[number];
export const countryCurrencies: Record<string,Currency> = {
  NP:"NPR",US:"USD",IN:"INR",GB:"GBP",AU:"AUD",CA:"CAD",CH:"CHF",CN:"CNY",JP:"JPY",
  SG:"SGD",HK:"HKD",AE:"AED",SA:"SAR",QA:"QAR",KW:"KWD",BH:"BHD",MY:"MYR",KR:"KRW",TH:"THB",
  SE:"SEK",DK:"DKK",DE:"EUR",FR:"EUR",IT:"EUR",ES:"EUR",NL:"EUR",IE:"EUR",PT:"EUR",AT:"EUR",BE:"EUR",FI:"EUR",GR:"EUR"
};
export function isCurrency(value: unknown): value is Currency {
  return currencies.some(currency=>currency===value);
}
export type ExchangeRates = {date:string; nprPerUnit: Record<string,number>};
export function parseRates(payload: unknown, today: string): ExchangeRates | null {
  const rows = (payload as {data?:{payload?:unknown}})?.data?.payload;
  if (!Array.isArray(rows)) return null;
  const valid = rows.filter(row=>typeof row?.date==="string" && /^\d{4}-\d{2}-\d{2}$/.test(row.date) && row.date<=today && Array.isArray(row.rates))
    .sort((a,b)=>b.date.localeCompare(a.date));
  const row=valid[0];
  if (!row || Date.parse(today)-Date.parse(row.date)>7*86400000) return null;
  const nprPerUnit:Record<string,number>={NPR:1};
  for (const rate of row.rates) {
    const code=rate?.currency?.iso3;
    const unit=Number(rate?.currency?.unit),buy=Number(rate?.buy),sell=Number(rate?.sell);
    if(isCurrency(code)&&Number.isFinite(unit)&&unit>0&&Number.isFinite(buy)&&buy>0&&Number.isFinite(sell)&&sell>=buy)
      nprPerUnit[code]=(buy+sell)/(2*unit);
  }
  return {date:row.date,nprPerUnit};
}
export function convertAmount(amount:number, from:string, to:string, rates:ExchangeRates|null) {
  if(from===to) return amount;
  if(!rates || !rates.nprPerUnit[from] || !rates.nprPerUnit[to]) return null;
  return amount*rates.nprPerUnit[from]/rates.nprPerUnit[to];
}
export function moneyText(amount:number,currency:string) {
  return currency+" "+new Intl.NumberFormat("en",{minimumFractionDigits:2,maximumFractionDigits:2}).format(amount);
}
