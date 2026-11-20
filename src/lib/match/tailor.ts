import "server-only";
import { generate, type AIProvider } from "@/lib/ai";
import { TailoringSchema, type AtsScore, type Job, type Profile, type Tailoring } from "@/lib/types";
import { totalYears } from "./score";
import { dedupeSkills, replaceAliases, skillKey, textMentionsSkill } from "./skills";
import { TruthGuard } from "./truth";

export type TailorResult = {
  tailoring: Tailoring;
  profile: Profile;
  rejected: { original: string; rewritten: string; reasons: string[] }[];
};

const SYSTEM = `You are an expert resume writer who tailors a candidate's existing resume to a specific job so it passes Applicant Tracking Systems (ATS) and reads well to recruiters.

Absolute rules — violating any of them makes the output unusable:
1. Never invent facts. Do not add employers, titles, dates, degrees, certifications, metrics, numbers, team sizes or technologies that are not already in the candidate profile.
2. A skill listed under "missing_skills" must NOT appear anywhere in your output. The candidate does not have it.
3. Each rewritten bullet must describe the same work as its original. You may: reword for clarity and impact, lead with a strong action verb, use the job description's exact terminology for skills the candidate already has, and name a technology from the candidate's profile when the original bullet clearly involved it (e.g. a bullet about cloud deployment at a company where the candidate used AWS).
4. Keep bullets to one or two lines. No first person. No buzzword stuffing.
5. Only include rewrites that are a real improvement for this job; leave strong, relevant bullets untouched.

Write the headline as the candidate's professional title (it may echo the target role only if the candidate's experience supports it) and a 2–3 sentence summary grounded in the profile.`;

export async function tailorWithAI(
  ai: AIProvider,
  profile: Profile,
  job: Job,
  score: AtsScore,
): Promise<TailorResult> {
  const indexedExperience = profile.experience.map((e, i) => ({
    experienceIndex: i,
    title: e.title,
    company: e.company,
    dates: `${e.startDate} – ${e.endDate}`,
    bullets: e.bullets.map((b, j) => ({ bulletIndex: j, text: b })),
  }));

  const prompt = `<job>
${JSON.stringify(job, null, 2)}
</job>

<gap_analysis>
matched_skills: ${score.matchedSkills.join(", ") || "(none)"}
missing_skills: ${score.missingSkills.join(", ") || "(none)"}
missing_keywords: ${score.missingKeywords.join(", ") || "(none)"}
</gap_analysis>

<candidate_profile>
${JSON.stringify(
  {
    headline: profile.headline,
    summary: profile.summary,
    skills: profile.skills,
    years_of_experience: totalYears(profile),
    experience: indexedExperience,
    projects: profile.projects,
    education: profile.education,
    certifications: profile.certifications,
  },
  null,
  2,
)}
</candidate_profile>

Tailor this candidate's resume for the job. Return the headline, summary and the bullet rewrites (referencing experienceIndex/bulletIndex and copying the original text exactly).`;

  const tailoring = await generate(ai, {
    system: SYSTEM,
    prompt,
    schema: TailoringSchema,
    schemaName: "resume_tailoring",
  });
  return applyTailoring(profile, job, score, tailoring);
}

/** Deterministic tailoring used when no AI provider is configured. */
export function tailorOffline(profile: Profile, job: Job, score: AtsScore): TailorResult {
  const rewrites: Tailoring["rewrites"] = [];
  profile.experience.forEach((exp, i) =>
    exp.bullets.forEach((b, j) => {
      const rewritten = alignTerminology(b, job);
      if (rewritten !== b) rewrites.push({ experienceIndex: i, bulletIndex: j, original: b, rewritten });
    }),
  );
  return applyTailoring(profile, job, score, {
    headline: profile.headline || profile.experience[0]?.title || "",
    summary: offlineSummary(profile, score),
    rewrites,
  });
}

/**
 * Validate AI output against the truth guard and assemble the tailored
 * profile. Anything unsupported is dropped and the original kept.
 */
export function applyTailoring(
  profile: Profile,
  job: Job,
  score: AtsScore,
  tailoring: Tailoring,
): TailorResult {
  const guard = new TruthGuard(profile);
  const missing = new Set(score.missingSkills.flatMap((s) => s.split(" / ")).map(skillKey));
  const rejected: TailorResult["rejected"] = [];
  const accepted: Tailoring["rewrites"] = [];
  const experience = profile.experience.map((e) => ({ ...e, bullets: [...e.bullets] }));

  for (const r of tailoring.rewrites) {
    const original = profile.experience[r.experienceIndex]?.bullets[r.bulletIndex];
    if (original === undefined || norm(original) !== norm(r.original)) continue; // hallucinated index
    const rewritten = r.rewritten.trim();
    if (!rewritten || rewritten === original) continue;
    const reasons = guard.violations(rewritten, original);
    if (rewritten.length > Math.max(original.length * 2.5, 220)) reasons.push("too long");
    if (reasons.length) {
      rejected.push({ original, rewritten, reasons });
      continue;
    }
    experience[r.experienceIndex].bullets[r.bulletIndex] = rewritten;
    accepted.push({ ...r, original, rewritten });
  }

  const fallbackSummary = offlineSummary(profile, score);
  let summary = tailoring.summary.trim() || fallbackSummary;
  const summaryIssues = guard.violations(summary, profile.summary);
  if (summaryIssues.length || [...missing].some((m) => textMentionsSkill(summary, m))) {
    rejected.push({ original: profile.summary, rewritten: summary, reasons: summaryIssues.length ? summaryIssues : ["mentions a missing skill"] });
    summary = fallbackSummary;
  }
  let headline = tailoring.headline.trim() || profile.headline;
  if (guard.violations(headline, profile.headline).length) headline = profile.headline;

  // Relevance ordering: what the job cares about comes first, nothing is removed.
  const relevance = relevanceScorer(job);
  for (const e of experience) e.bullets = stableSortBy(e.bullets, relevance);
  const projects = stableSortBy(profile.projects, (p) =>
    relevance([p.name, p.description, p.technologies.join(" "), ...p.bullets].join(" ")),
  );

  // Skills: job-relevant ones first, plus JD skills evidenced in bullets but not yet listed.
  const evidenced = score.matchedSkills.filter((s) => !profile.skills.some((p) => skillKey(p) === skillKey(s)));
  const allSkills = dedupeSkills([...profile.skills, ...evidenced]);
  const jobOrder = new Map(dedupeSkills(job.skills).map((s, i) => [skillKey(s), i]));
  const skills = stableSortBy(allSkills, (s) => (jobOrder.has(skillKey(s)) ? 1000 - jobOrder.get(skillKey(s))! : 0));

  return {
    tailoring: { headline, summary, rewrites: accepted },
    profile: { ...profile, headline, summary, skills, experience, projects },
    rejected,
  };
}

function norm(s: string) {
  return s.replace(/\s+/g, " ").trim().toLowerCase();
}

function relevanceScorer(job: Job) {
  const skills = dedupeSkills(job.skills);
  const keywords = job.keywords.map((k) => k.toLowerCase());
  return (text: string) =>
    skills.filter((s) => textMentionsSkill(text, s)).length * 2 +
    keywords.filter((k) => text.toLowerCase().includes(k)).length;
}

function stableSortBy<T>(items: T[], score: (item: T) => number): T[] {
  return items
    .map((item, i) => ({ item, i, s: score(item) }))
    .sort((a, b) => b.s - a.s || a.i - b.i)
    .map((x) => x.item);
}

/** Replace skill aliases with the job's exact wording ("postgres" → "PostgreSQL"). */
function alignTerminology(bullet: string, job: Job): string {
  return dedupeSkills(job.skills).reduce((text, skill) => replaceAliases(text, skill), bullet);
}

function offlineSummary(profile: Profile, score: AtsScore): string {
  const years = totalYears(profile);
  const role = profile.headline || profile.experience[0]?.title || "Professional";
  const top = (score.matchedSkills.length ? score.matchedSkills : profile.skills).slice(0, 5);
  const parts = [
    `${role}${years >= 1 ? ` with ${Math.floor(years)}+ years of experience` : ""}${top.length ? ` in ${listJoin(top)}` : ""}.`,
  ];
  const recent = profile.experience[0];
  if (recent?.company) parts.push(`Most recently ${recent.title} at ${recent.company}.`);
  if (profile.summary) parts.push(profile.summary.split(/(?<=\.)\s/)[0]);
  return parts.join(" ").trim();
}

function listJoin(items: string[]) {
  return items.length <= 1 ? items.join("") : `${items.slice(0, -1).join(", ")} and ${items.at(-1)}`;
}
