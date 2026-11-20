import type { AtsScore, Job, Profile } from "@/lib/types";
import { canonicalSkill, dedupeSkills, skillKey, textMentionsSkill } from "./skills";

/** All human-readable text of a profile, as an ATS would see it. */
export function profileText(p: Profile): string {
  return [
    p.headline,
    p.summary,
    p.skills.join(", "),
    ...p.experience.flatMap((e) => [e.title, e.company, ...e.bullets]),
    ...p.projects.flatMap((pr) => [pr.name, pr.description, pr.technologies.join(", "), ...pr.bullets]),
    ...p.education.flatMap((e) => [e.degree, e.field, e.institution, ...e.details]),
    ...p.certifications,
    ...p.achievements,
  ]
    .filter(Boolean)
    .join("\n");
}

const MONTHS: Record<string, number> = {
  jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5, jul: 6, aug: 7, sep: 8, sept: 8, oct: 9, nov: 10, dec: 11,
};

/** Parse "Jan 2020", "January 2020", "01/2020", "2020-01", "2020", "Present" to a month index. */
export function parseMonth(raw: string, now = new Date()): number | null {
  const s = raw.trim().toLowerCase();
  if (!s) return null;
  if (/present|current|now|today/.test(s)) return now.getFullYear() * 12 + now.getMonth();
  let m = s.match(/^([a-z]{3,9})\.?\s+(\d{4})$/);
  if (m && MONTHS[m[1].slice(0, 4)] !== undefined) return +m[2] * 12 + MONTHS[m[1].slice(0, 4)];
  if (m && MONTHS[m[1].slice(0, 3)] !== undefined) return +m[2] * 12 + MONTHS[m[1].slice(0, 3)];
  m = s.match(/^(\d{1,2})[/.-](\d{4})$/);
  if (m) return +m[2] * 12 + (+m[1] - 1);
  m = s.match(/^(\d{4})[/.-](\d{1,2})$/);
  if (m) return +m[1] * 12 + (+m[2] - 1);
  m = s.match(/(\d{4})/);
  if (m) return +m[1] * 12;
  return null;
}

/** Total years of experience, merging overlapping roles. */
export function totalYears(p: Profile, now = new Date()): number {
  const intervals: [number, number][] = [];
  for (const e of p.experience) {
    const start = parseMonth(e.startDate, now);
    if (start === null) continue;
    const end = parseMonth(e.endDate || "present", now) ?? start;
    if (end >= start) intervals.push([start, end + 1]);
  }
  intervals.sort((a, b) => a[0] - b[0]);
  let months = 0;
  let cur: [number, number] | null = null;
  for (const iv of intervals) {
    if (!cur || iv[0] > cur[1]) {
      if (cur) months += cur[1] - cur[0];
      cur = [...iv];
    } else cur[1] = Math.max(cur[1], iv[1]);
  }
  if (cur) months += cur[1] - cur[0];
  return Math.round((months / 12) * 10) / 10;
}

const LEVEL_YEARS: Record<Job["experienceLevel"], number | null> = {
  intern: 0,
  entry: 0,
  mid: 3,
  senior: 5,
  lead: 7,
  executive: 10,
  unspecified: null,
};

const TITLE_NOISE = new Set(["senior", "sr", "junior", "jr", "lead", "staff", "principal", "i", "ii", "iii", "iv", "the", "of", "and", "-", "&"]);

function titleTokens(t: string) {
  return t
    .toLowerCase()
    .split(/[^a-z0-9+#.]+/)
    .filter((w) => w && !TITLE_NOISE.has(w));
}

function titleSimilarity(jobTitle: string, p: Profile): number {
  const target = new Set(titleTokens(jobTitle));
  if (target.size === 0) return 1;
  let best = 0;
  for (const title of [p.headline, ...p.experience.map((e) => e.title)]) {
    const toks = titleTokens(title);
    const overlap = toks.filter((w) => target.has(w)).length;
    best = Math.max(best, overlap / target.size);
  }
  return best;
}

function keywordPresent(text: string, keyword: string): boolean {
  const lower = text.toLowerCase();
  const k = keyword.toLowerCase().trim();
  if (lower.includes(k)) return true;
  // Multi-word phrase: accept if every significant word appears.
  const parts = k.split(/\s+/).filter((w) => w.length > 2);
  return parts.length > 1 && parts.every((w) => new RegExp(`\\b${w.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}`).test(lower));
}

const pct = (n: number, d: number) => (d === 0 ? 100 : Math.round((n / d) * 100));

/**
 * Deterministic ATS match score. Same inputs → same score, so users can trust
 * that a higher number after tailoring reflects real keyword coverage.
 */
export function scoreMatch(profile: Profile, job: Job, now = new Date()): AtsScore {
  const text = profileText(profile);
  const profileSkillKeys = new Set(profile.skills.map(skillKey));

  const has = (s: string) => profileSkillKeys.has(skillKey(s)) || textMentionsSkill(text, s);
  const jobSkills = dedupeSkills(job.skills);

  // Alternatives ("FastAPI or Django"): one member satisfies the group; the
  // others are neither required nor reported as gaps. An unmet group counts once.
  const groupOf = new Map<string, string[]>();
  for (const g of job.alternatives ?? []) {
    const members = dedupeSkills(g);
    for (const m of members) groupOf.set(skillKey(m), members);
  }
  const matchedSkills: string[] = [];
  const missingSkills: string[] = [];
  const seenGroups = new Set<string[]>();
  let required = 0;
  for (const s of jobSkills) {
    const group = groupOf.get(skillKey(s));
    if (group) {
      if (seenGroups.has(group)) continue;
      seenGroups.add(group);
      required++;
      const hit = group.filter(has);
      if (hit.length) matchedSkills.push(...hit.map(canonicalSkill));
      else missingSkills.push(group.map(canonicalSkill).join(" / "));
      continue;
    }
    required++;
    if (has(s)) matchedSkills.push(canonicalSkill(s));
    else missingSkills.push(canonicalSkill(s));
  }

  const skillSet = new Set(jobSkills.map(skillKey));
  const keywords = [...new Set(job.keywords.map((k) => k.trim()).filter((k) => k && !skillSet.has(skillKey(k))))];
  const matchedKeywords = keywords.filter((k) => keywordPresent(text, k));
  const missingKeywords = keywords.filter((k) => !matchedKeywords.includes(k));

  const requiredYears = job.minYearsExperience ?? LEVEL_YEARS[job.experienceLevel];
  const years = totalYears(profile, now);
  const yearsScore = requiredYears === null || requiredYears === 0 ? 1 : Math.min(1, years / requiredYears);
  const titleScore = titleSimilarity(job.title, profile);
  const experience = Math.round((0.6 * yearsScore + 0.4 * titleScore) * 100);

  const skills = pct(required - missingSkills.length, required);
  const kw = pct(matchedKeywords.length, keywords.length);
  const overall = Math.round(0.45 * skills + 0.25 * experience + 0.3 * kw);

  return {
    overall,
    skills,
    experience,
    keywords: kw,
    matchedSkills,
    missingSkills,
    matchedKeywords,
    missingKeywords,
  };
}
