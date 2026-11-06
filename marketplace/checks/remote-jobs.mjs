import assert from "node:assert/strict";
import { readRemoteTerms, remoteEligibility } from "../src/lib/remote-job.ts";
import { formatNpr } from "../src/lib/discovery.ts";

function terms(scope, region, mode = "remote") {
  const form = new FormData();
  form.set("remote_scope", scope);
  form.set("eligible_regions", region);
  return readRemoteTerms(form, mode);
}

assert.equal(remoteEligibility(terms("worldwide", "")), "Open worldwide");
assert.equal(remoteEligibility(terms("regions", " Nepal and India ")), "Open to applicants in Nepal and India");
assert.equal(terms("regions", " "), null);
assert.equal(terms("invalid", ""), null);
assert.equal(remoteEligibility(terms("", "")), "");
assert.equal(remoteEligibility(terms("worldwide", "", "hybrid")), "");
assert.equal(formatNpr(15,20,false,"USD"), "USD 15–20");
console.log("Remote eligibility and advertised pay checks passed.");
