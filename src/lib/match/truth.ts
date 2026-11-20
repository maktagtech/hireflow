import type { Profile } from "@/lib/types";
import { profileText, totalYears } from "./score";
import { extractSkillsFromText, skillKey } from "./skills";

/**
 * Truthfulness guard. Generated text may only reference skills and figures
 * that already appear somewhere in the user's master profile.
 */
export class TruthGuard {
  private allowedSkills: Set<string>;
  private allowedNumbers: Set<string>;

  constructor(profile: Profile) {
    const text = profileText(profile);
    this.allowedSkills = new Set([
      ...profile.skills.map(skillKey),
      ...extractSkillsFromText(text).map(skillKey),
    ]);
    this.allowedNumbers = new Set(numbersIn(text));
    // "N+ years" derived from the user's own dates (any N up to the real total) is truthful.
    for (let n = 1; n <= Math.floor(totalYears(profile)); n++) {
      this.allowedNumbers.add(String(n));
      this.allowedNumbers.add(`${n}+`);
    }
  }

  /** Returns the reasons a piece of generated text is unsupported (empty = OK). */
  violations(generated: string, source = ""): string[] {
    const reasons: string[] = [];
    const sourceSkills = new Set(extractSkillsFromText(source).map(skillKey));
    for (const s of extractSkillsFromText(generated)) {
      const k = skillKey(s);
      if (!this.allowedSkills.has(k) && !sourceSkills.has(k)) reasons.push(`unsupported skill "${s}"`);
    }
    const sourceNumbers = new Set(numbersIn(source));
    for (const n of numbersIn(generated)) {
      if (!this.allowedNumbers.has(n) && !sourceNumbers.has(n)) reasons.push(`unsupported figure "${n}"`);
    }
    return reasons;
  }
}

/** Numeric claims ("40%", "$2M", "3x", "120") normalized for comparison. */
function numbersIn(text: string): string[] {
  return (text.match(/\d[\d,.]*\s*[%kKmMbBxX+]?/g) ?? [])
    .map((n) => n.replace(/[,\s]/g, "").replace(/\.$/, "").toLowerCase())
    // Years (e.g. "2021") and small ordinals are context, not claims.
    .filter((n) => !/^(19|20)\d{2}$/.test(n));
}
