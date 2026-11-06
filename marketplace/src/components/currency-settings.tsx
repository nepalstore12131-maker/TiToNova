"use client";
import {UiIcon} from "@/components/workspace-ui";
import {useState} from "react";
import {currencies,countryCurrencies} from "@/lib/currency";
export function CurrencySettings({country,currency,action}:{country:string;currency:string;action:(form:FormData)=>void}) {
 const [region,setRegion]=useState(country),[unit,setUnit]=useState(currency);
 const names=new Intl.DisplayNames(["en"],{type:"region"});
 const regions=Object.keys(countryCurrencies).sort((a,b)=>(names.of(a)||a).localeCompare(names.of(b)||b));
 return <section className="dashboard-card"><h2 className="icon-title"><UiIcon name="wallet"/>Country & display currency</h2><form action={action} className="auth-form">
 <label>Country<select name="country" value={region} onChange={e=>{setRegion(e.target.value);if(countryCurrencies[e.target.value])setUnit(countryCurrencies[e.target.value]);}}>
 <option value="">Other country / choose currency below</option>{regions.map(code=><option key={code} value={code}>{names.of(code)}</option>)}</select></label>
 <label>Display currency<select name="display_currency" value={unit} onChange={e=>setUnit(e.target.value)}>{currencies.map(code=><option key={code}>{code}</option>)}</select></label>
 <p>Converted amounts use Nepal Rastra Bank reference rates. The original price is shown alongside the estimate. Checkout confirms the payment currency and final amount.</p>
 <button className="button">Save currency</button></form></section>;
}
