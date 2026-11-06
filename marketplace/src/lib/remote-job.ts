export type RemoteTerms = {remote_scope: string | null; eligible_regions: string; required_timezone: string};

export function readRemoteTerms(form: FormData, mode: string): RemoteTerms | null {
  const empty = {remote_scope: null, eligible_regions: "", required_timezone: ""};
  if (mode !== "remote") return empty;
  const scope = String(form.get("remote_scope") ?? "");
  const regions = String(form.get("eligible_regions") ?? "").trim();
  const timezone = String(form.get("required_timezone") ?? "").trim();
  if (timezone.length > 80 || !["", "worldwide", "regions"].includes(scope)) return null;
  if (scope === "regions" && (!regions || regions.length > 180)) return null;
  return {remote_scope: scope || null, eligible_regions: scope === "regions" ? regions : "", required_timezone: timezone};
}

export function remoteEligibility(terms?: Partial<RemoteTerms>, ne = false) {
  if (terms?.remote_scope === "worldwide") return ne ? "जहाँबाट पनि आवेदन खुला" : "Open worldwide";
  if (terms?.remote_scope === "regions") return ne ? `आवेदन खुला · ${terms.eligible_regions}` : `Open to applicants in ${terms.eligible_regions}`;
  return "";
}
