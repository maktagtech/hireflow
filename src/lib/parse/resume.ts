import "server-only";
import { AIProviderError, generate, getAI } from "@/lib/ai";
import { dedupeSkills, extractSkillsFromText } from "@/lib/match/skills";
import { ProfileSchema, type Profile } from "@/lib/types";
import { parseResumeHeuristic } from "./resume-heuristic";

const SYSTEM = `You convert resume text into structured JSON. Extract exactly what the document says — never infer, embellish or add information that is not present.

- Keep every experience bullet verbatim (fix only broken line-wraps and stray bullet characters).
- Order experience most recent first. Use "Present" for current roles. Keep dates as written (e.g. "Jan 2021").
- "skills" lists every distinct skill, tool or technology the resume names, including ones only mentioned in bullets.
- Leave a field empty when the resume doesn't contain it.
- LinkedIn PDF exports: the "Top Skills" and "Certifications" sidebars map to skills and certifications; ignore "Page N of M" lines.`;

export async function structureResume(text: string): Promise<{ profile: Profile; via: string }> {
  const ai = getAI();
  if (!ai) return { profile: parseResumeHeuristic(text), via: "offline" };

  let profile: Profile;
  try {
    profile = await generate(ai, {
      system: SYSTEM,
      prompt: `<resume>\n${text}\n</resume>`,
      schema: ProfileSchema,
      schemaName: "resume_profile",
    });
  } catch (err) {
    // AI unavailable (outage, quota, billing): the rule-based parser keeps uploads working.
    if (!(err instanceof AIProviderError)) throw err;
    console.error(`[ai:${err.provider}] resume parsing fell back to offline parser:`, err.message);
    return { profile: parseResumeHeuristic(text), via: `${ai.name}+offline` };
  }
  // Dictionary pass guarantees skills the model skipped are still captured.
  profile.skills = dedupeSkills([...profile.skills, ...extractSkillsFromText(text)]);
  return { profile, via: ai.name };
}
