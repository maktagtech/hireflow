import "server-only";
import * as cheerio from "cheerio";
import { AIProviderError, generate, getAI } from "@/lib/ai";
import { dedupeSkills, extractKeywordsFromText, extractSkillsFromText } from "@/lib/match/skills";
import { JobSchema, type Job } from "@/lib/types";
import { HttpError } from "@/lib/api";
import { fetchPublicHtml } from "./fetch-url";
import { htmlToText } from "./html";

export type ImportedJob = { job: Job; description: string; url: string | null };

type Hints = { title?: string; company?: string; location?: string };

const MAX_JD_CHARS = 40_000;

/** Turn a job URL into readable description text plus any structured hints. */
export async function scrapeJobPage(rawUrl: string): Promise<{ text: string; hints: Hints; url: string }> {
  const { html, finalUrl } = await fetchPublicHtml(rawUrl);
  const $ = cheerio.load(html);
  const hints: Hints = {};

  // Most ATS platforms (Greenhouse, Lever, Workday, Ashby, LinkedIn) publish schema.org JobPosting.
  let structured = "";
  $('script[type="application/ld+json"]').each((_, el) => {
    if (structured) return;
    try {
      const data = JSON.parse($(el).text());
      const nodes: unknown[] = Array.isArray(data) ? data : data["@graph"] ?? [data];
      const posting = nodes.find(
        (n): n is Record<string, unknown> =>
          typeof n === "object" && n !== null && String((n as Record<string, unknown>)["@type"]).includes("JobPosting"),
      );
      if (!posting) return;
      hints.title = String(posting.title ?? "") || undefined;
      const org = posting.hiringOrganization as { name?: string } | undefined;
      hints.company = org?.name;
      const loc = posting.jobLocation as { address?: { addressLocality?: string; addressRegion?: string } } | undefined;
      const addr = Array.isArray(loc) ? loc[0]?.address : loc?.address;
      hints.location = [addr?.addressLocality, addr?.addressRegion].filter(Boolean).join(", ") || undefined;
      structured = htmlToText(String(posting.description ?? ""));
      // Some sites entity-escape the HTML inside JSON-LD ("&lt;p&gt;…"); decode a second time.
      if (/<\/?(p|li|ul|br|div|strong)\b/i.test(structured)) structured = htmlToText(structured);
    } catch {
      /* malformed JSON-LD — fall through to page text */
    }
  });

  hints.title ??= $('meta[property="og:title"]').attr("content") ?? ($("h1").first().text().trim() || undefined);
  hints.company ??= $('meta[property="og:site_name"]').attr("content");

  let text = structured;
  if (text.length < 200) {
    $("script, style, noscript, svg, nav, header, footer, form, iframe").remove();
    const main = $("main, article, [role=main], #content, .job-description, .description").first();
    text = htmlToText((main.length ? main : $("body")).html() ?? "");
  }
  if (text.length < 200) {
    throw new HttpError(422, "Couldn't find a job description on that page. Paste the description text instead.");
  }
  return { text: text.slice(0, MAX_JD_CHARS), hints, url: finalUrl };
}

const SYSTEM = `You extract structured data from job descriptions for an ATS matching engine. Only use information present in the text.

- skills: concrete hard skills, tools, languages, frameworks, platforms and certifications the role asks for (required and preferred), using their standard names (e.g. "Kubernetes", "CI/CD", "PostgreSQL"). No soft skills here.
- keywords: other terms an ATS would scan for that aren't tools — domain, methodology and responsibility phrases (e.g. "payments", "distributed systems", "stakeholder management", "code review"). 8–20 items, short phrases.
- alternatives: groups of interchangeable skills from "X or Y" phrasing (e.g. "FastAPI or Django" → ["FastAPI","Django"]). Each member must also appear in skills.
- requirements / responsibilities: the listed items, lightly cleaned, verbatim meaning.
- minYearsExperience: the minimum years stated, or null.
- experienceLevel: infer from title and years (intern, entry, mid, senior, lead, executive) or "unspecified".`;

export async function structureJob(text: string, hints: Hints = {}): Promise<Job> {
  const ai = getAI();
  const dictSkills = extractSkillsFromText(text);
  let job: Job;
  try {
    job = ai
      ? await generate(ai, {
          system: SYSTEM,
          prompt: `${hints.title ? `Page title: ${hints.title}\n` : ""}${hints.company ? `Company: ${hints.company}\n` : ""}<job_description>\n${text}\n</job_description>`,
          schema: JobSchema,
          schemaName: "job_posting",
        })
      : parseJobHeuristic(text, hints);
  } catch (err) {
    // AI unavailable (outage, quota, billing): fall back to the rule-based parser.
    if (!(err instanceof AIProviderError)) throw err;
    console.error(`[ai:${err.provider}] job parsing fell back to offline parser:`, err.message);
    job = parseJobHeuristic(text, hints);
  }
  job.title ||= hints.title ?? "";
  job.company ||= hints.company ?? "";
  job.location ||= hints.location ?? "";
  job.skills = dedupeSkills([...job.skills, ...dictSkills]);
  job.alternatives = mergeGroups([...job.alternatives, ...detectAlternatives(text)]);
  return job;
}

/**
 * Find "X or Y" / "X, Y, or Z" skill alternatives, one clause at a time.
 * Only the skills directly joined by "or" are grouped ("AWS and Docker or
 * similar" groups nothing).
 */
export function detectAlternatives(text: string): string[][] {
  const groups: string[][] = [];
  for (const clause of text.split(/[\n;.()]+/)) {
    if (!/\bor\b|\s\/\s|\w\/\w/i.test(clause)) continue;
    const pieces = clause.split(/\s+or\s+|\s*\/\s*/i);
    for (let i = 0; i < pieces.length - 1; i++) {
      const left = pieces[i].split(/\band\b|\bwith\b|\bin\b|:/i).pop() ?? "";
      const right = pieces[i + 1].split(/,|\band\b|\bwith\b/i)[0] ?? "";
      const skills = dedupeSkills([...extractSkillsFromText(left), ...extractSkillsFromText(right)]);
      if (skills.length >= 2 && extractSkillsFromText(right).length > 0) groups.push(skills);
    }
  }
  return mergeGroups(groups);
}

function mergeGroups(groups: string[][]): string[][] {
  const merged: string[][] = [];
  for (const g of groups.map((x) => dedupeSkills(x)).filter((x) => x.length >= 2)) {
    const hit = merged.find((m) => m.some((s) => g.some((t) => s.toLowerCase() === t.toLowerCase())));
    if (hit) hit.splice(0, hit.length, ...dedupeSkills([...hit, ...g]));
    else merged.push(g);
  }
  return merged;
}

export async function importJob(input: { url?: string; text?: string }): Promise<ImportedJob> {
  if (input.text && input.text.trim().length >= 100) {
    const description = input.text.trim().slice(0, MAX_JD_CHARS);
    return { job: await structureJob(description), description, url: input.url?.trim() || null };
  }
  if (input.url) {
    const { text, hints, url } = await scrapeJobPage(input.url);
    return { job: await structureJob(text, hints), description: text, url };
  }
  throw new HttpError(400, "Paste a job URL or a job description (at least a few sentences).");
}

// ---------------------------------------------------------------- heuristic

const REQ_HEAD = /(requirements|qualifications|what you('ll)? (need|bring)|who you are|must have|you have|skills|preferred|nice to have|about you)/i;
const RESP_HEAD = /(responsibilities|what you('ll)? do|the role|your impact|day to day|in this role|duties)/i;

export function parseJobHeuristic(text: string, hints: Hints = {}): Job {
  const lines = text.split("\n").map((l) => l.trim()).filter(Boolean);
  const requirements: string[] = [];
  const responsibilities: string[] = [];
  let bucket: string[] | null = null;
  for (const line of lines) {
    const isItem = /^[•\-*●▪]\s*/.test(line);
    if (!isItem && line.length < 80) {
      if (REQ_HEAD.test(line)) bucket = requirements;
      else if (RESP_HEAD.test(line)) bucket = responsibilities;
      else if (/:$/.test(line) || line.split(" ").length <= 5) bucket = null;
      continue;
    }
    if (isItem && bucket) bucket.push(line.replace(/^[•\-*●▪]\s*/, ""));
  }

  const years = [...text.matchAll(/(\d{1,2})\s*\+?\s*(?:-\s*\d{1,2}\s*)?(?:years?|yrs?)/gi)].map((m) => +m[1]).filter((n) => n < 30);
  const minYears = years.length ? Math.min(...years) : null;
  const title = hints.title ?? lines[0] ?? "";
  const t = title.toLowerCase();
  const level: Job["experienceLevel"] = /intern/.test(t)
    ? "intern"
    : /(chief|vp|vice president|director|head of)/.test(t)
      ? "executive"
      : /(lead|principal|staff|manager)/.test(t)
        ? "lead"
        : /(senior|sr\.?)\b/.test(t)
          ? "senior"
          : /(junior|jr\.?|graduate|entry)/.test(t)
            ? "entry"
            : minYears !== null
              ? minYears >= 5 ? "senior" : minYears >= 2 ? "mid" : "entry"
              : "unspecified";

  // Pasted JDs often start "Title\nCompany": accept a short Title-Case second line.
  const second = lines[1] ?? "";
  const companyGuess =
    !hints.title && second.split(" ").length <= 4 && /^[A-Z][\w&.,'-]*(\s+[A-Z0-9][\w&.,'-]*)*$/.test(second) &&
    !REQ_HEAD.test(second) && !RESP_HEAD.test(second) && !/^about\b/i.test(second)
      ? second
      : "";

  return JobSchema.parse({
    title,
    company: hints.company ?? companyGuess,
    location: hints.location ?? "",
    experienceLevel: level,
    minYearsExperience: minYears,
    skills: extractSkillsFromText(text),
    alternatives: detectAlternatives(text),
    requirements,
    responsibilities,
    keywords: extractKeywordsFromText([...requirements, ...responsibilities].join("\n") || text),
  });
}
