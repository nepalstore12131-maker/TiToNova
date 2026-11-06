import { workModes } from "./discovery";

export function readWorkerPreferences(form: FormData, categories: string[]) {
  const interests = [...new Set(form.getAll("interests").map(String))];
  const modes = [...new Set(form.getAll("work_modes").map(String))];
  const bio = String(form.get("bio") ?? "").trim();
  if (!bio || bio.length > 3000 || !interests.length || !modes.length ||
      interests.some(c => !categories.includes(c)) ||
      modes.some(m => !workModes.some(valid => valid === m))) return null;
  return { bio, work_interests: interests, preferred_work_modes: modes };
}
