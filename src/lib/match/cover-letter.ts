import "server-only";
import { generate, type AIProvider } from "@/lib/ai";
import { CoverLetterSchema, type AtsScore, type CoverLetter, type Job, type Profile } from "@/lib/types";
import { totalYears } from "./score";
import { dedupeSkills, replaceAliases } from "./skills";
import { TruthGuard } from "./truth";

const SYSTEM = `You write concise, specific cover letters (250–350 words, 3–4 body paragraphs).

Rules:
- Use only facts from the candidate profile. Never invent achievements, metrics, employers or skills. Never claim a skill listed as missing.
- Open with the specific role and company and one concrete reason the candidate fits — no "I am writing to apply" clichés.
- Middle paragraphs: connect 2–3 of the candidate's real accomplishments to the job's top requirements, using the job's terminology.
- Close with a short, confident call to action.
- Plain professional tone. No placeholders like [Company]; if the company name is unknown, refer to "your team".
- Do not include the signature name in "closing" beyond a sign-off phrase like "Sincerely,".`;

export async function coverLetterWithAI(
  ai: AIProvider,
  profile: Profile,
  job: Job,
  score: AtsScore,
): Promise<CoverLetter> {
  const letter = await generate(ai, {
    system: SYSTEM,
    prompt: `<job>\n${JSON.stringify(job, null, 2)}\n</job>\n\n<missing_skills>${score.missingSkills.join(", ") || "none"}</missing_skills>\n\n<candidate_profile>\n${JSON.stringify(
      { ...profile, years_of_experience: totalYears(profile) },
      null,
      2,
    )}\n</candidate_profile>`,
    schema: CoverLetterSchema,
    schemaName: "cover_letter",
  });

  // A letter that cites unsupported skills or figures is replaced, not shipped.
  const guard = new TruthGuard(profile);
  const issues = letter.paragraphs.flatMap((p) => guard.violations(p));
  return issues.length ? coverLetterOffline(profile, job, score) : letter;
}

export function coverLetterOffline(profile: Profile, job: Job, score: AtsScore): CoverLetter {
  const company = job.company || "your team";
  const role = job.title || "this role";
  // Use the job's spelling of skills the candidate has ("postgres" → "PostgreSQL").
  const align = (s: string) => dedupeSkills(job.skills).reduce((t, skill) => replaceAliases(t, skill), s);
  // Turn the posting's voice into the applicant's ("our platform" → "your platform").
  const toYour = (s: string) => s.replace(/\bour\b/gi, "your").replace(/\bus\b/g, "you").replace(/\bwe\b/gi, "you");
  const years = Math.floor(totalYears(profile));
  const recent = profile.experience[0];
  const strengths = (score.matchedSkills.length ? score.matchedSkills : profile.skills).slice(0, 4);

  // Pick the bullets that best evidence the job's skills.
  const bullets = profile.experience
    .flatMap((e) => e.bullets.map((b) => ({ b, e })))
    .map((x) => ({ ...x, hits: strengths.filter((s) => x.b.toLowerCase().includes(s.toLowerCase())).length }))
    .sort((a, b) => b.hits - a.hits)
    .slice(0, 2);

  const paragraphs = [
    `I'm excited to apply for the ${role} position${job.company ? ` at ${job.company}` : ""}. ${
      recent ? `As ${article(recent.title)} ${recent.title}${recent.company ? ` at ${recent.company}` : ""}` : "In my work"
    }${years >= 1 ? ` with ${years}+ years of experience` : ""}, I've built a strong foundation in ${list(strengths) || "the areas this role focuses on"}, which aligns closely with what you're looking for.`,
  ];
  if (bullets.length) {
    paragraphs.push(
      `A few examples of relevant work: ${bullets
        .map(({ b, e }) => `at ${e.company || "a previous role"}, I ${lowerFirst(align(b).replace(/\.$/, ""))}`)
        .join("; and ")}.`,
    );
  }
  if (job.responsibilities.length) {
    paragraphs.push(
      `The opportunity to ${lowerFirst(toYour(job.responsibilities[0]).replace(/\.$/, ""))} particularly appeals to me, and I'm confident my experience would let me contribute quickly.`,
    );
  }
  paragraphs.push(
    `I'd welcome the chance to discuss how I can help ${company} succeed. Thank you for your time and consideration.`,
  );
  return { greeting: "Dear Hiring Manager,", paragraphs, closing: "Sincerely," };
}

function list(items: string[]) {
  return items.length <= 1 ? items.join("") : `${items.slice(0, -1).join(", ")} and ${items.at(-1)}`;
}
function article(word: string) {
  return /^[aeiou]/i.test(word) ? "an" : "a";
}
function lowerFirst(s: string) {
  return /^[A-Z][a-z]/.test(s) ? s[0].toLowerCase() + s.slice(1) : s;
}
