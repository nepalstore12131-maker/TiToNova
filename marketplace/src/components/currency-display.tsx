"use client";
import {createContext,useContext,useEffect,useState,type ReactNode} from "react";
import {convertAmount,moneyText,type ExchangeRates} from "@/lib/currency";
const CurrencyContext=createContext<{currency:string;rates:ExchangeRates|null}>({currency:"NPR",rates:null});
export function CurrencyDisplayProvider({currency,children}:{currency:string;children:ReactNode}) {
  const [rates,setRates]=useState<ExchangeRates|null>(null);
  useEffect(()=>{
    let active=true;
    const controller=new AbortController();
    async function update() {
      try {const response=await fetch("/api/exchange-rates",{signal:controller.signal});
        const value=response.ok?await response.json():null;if(active)setRates(value);
      }catch {if(active)setRates(null);}
    }
    void update();const timer=setInterval(()=>void update(),3600000);
    return ()=>{active=false;controller.abort();clearInterval(timer)};
  },[]);
  return <CurrencyContext.Provider value={{currency,rates}}>{children}</CurrencyContext.Provider>;
}
export function Money({amount,currency="NPR"}:{amount:number;currency?:string}) {
  const display=useContext(CurrencyContext);
  const converted=convertAmount(amount,currency,display.currency,display.rates);
  const changed=currency!==display.currency;
  if(converted===null) return <span>{moneyText(amount,currency)}<small> · Conversion unavailable</small></span>;
  return <span title={changed?`Approximate · NRB midpoint · ${display.rates?.date} · Original ${moneyText(amount,currency)}`:undefined}>
    {changed?"≈ ":""}{moneyText(converted,display.currency)}
    {changed&&<small> · {moneyText(amount,currency)} · {display.rates?.date}</small>}
  </span>;
}

export function MoneyRange({min,max,currency="NPR",ne=false}:{min:number|null;max:number|null;currency?:string;ne?:boolean}) {
  if(min===null && max===null) return <>{ne?"पारिश्रमिक छलफलमा":"Pay to discuss"}</>;
  return <>{min===null?"Up to ":<Money amount={min} currency={currency}/>}
    {min===null?<Money amount={max!} currency={currency}/>:max===null?"+":<> – <Money amount={max} currency={currency}/></>}</>;
}

export function useMoneyText() {
 const {currency,rates}=useContext(CurrencyContext);
 return (amount:number,original="NPR")=>{
   const value=convertAmount(amount,original,currency,rates);
   return value===null?moneyText(amount,original):`${original!==currency?"≈ ":""}${moneyText(value,currency)}`;
 };
}
