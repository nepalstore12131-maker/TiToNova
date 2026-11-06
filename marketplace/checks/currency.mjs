import assert from "node:assert/strict";
import {parseRates,convertAmount,countryCurrencies} from "../src/lib/currency.ts";
const sample={data:{payload:[{date:"2026-11-06",rates:[
 {currency:{iso3:"USD",unit:1},buy:"149",sell:"151"},
 {currency:{iso3:"INR",unit:100},buy:"160",sell:"160.2"}
]}]}};
const rates=parseRates(sample,"2026-11-06");
assert.equal(convertAmount(500,"NPR","USD",rates),500/150);
assert.equal(convertAmount(1,"USD","NPR",rates),150);
assert.ok(Math.abs(convertAmount(500,"NPR","INR",rates)-500/1.601)<1e-9);
assert.equal(convertAmount(0,"NPR","USD",rates),0);
assert.equal(convertAmount(500,"NPR","USD",null),null);
assert.equal(parseRates(sample,"2026-11-20"),null);
assert.equal(parseRates(sample,"2026-11-01"),null);
assert.equal(countryCurrencies.US,"USD");assert.equal(countryCurrencies.IN,"INR");
console.log("PASS conversion direction, multi-unit rates, zero, unavailable and stale data, country defaults");
