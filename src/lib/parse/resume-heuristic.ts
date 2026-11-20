import { ProfileSchema, type Profile } from "@/lib/types";
import { dedupeSkills, extractSkillsFromText } from "@/lib/match/skills";

/**
 * Rule-based resume parser used when no AI provider is configured (and as a
 * cross-check for AI output). Handles the common single-column layouts of
 * Word/PDF resumes and LinkedIn "Save to PDF" exports.
 */

type Section =
  | "header"
  | "summary"
  | "experience"
  | "education"
  | "skills"
  | "projects"
  | "certifications"
  | "achievements"
  | "other";

const HEADINGS: [Section, RegExp][] = [
  ["summary", /^(professional\s+)?(summary|profile|about( me)?|objective|overview)$/],
  ["experience", /^((professional|work|relevant)\s+)?(experience|employment( history)?|work history|career history)$/],
  ["education", /^(education|academic background|education & training)$/],
  ["skills", /^((technical|core|key|top)\s+)?(skills|competencies|technologies|tech stack|skills & tools)$/],
  ["projects", /^((personal|selected|key|side)\s+)?projects$/],
  ["certifications", /^(certifications?|licenses?( & certifications)?|licenses and certifications|courses)$/],
  ["achievements", /^(achievements|awards|honors( & awards)?|honors-awards|accomplishments)$/],
  ["other", /^(languages|interests|volunteer( experience)?|references|publications|contact)$/],
];

const BULLET = /^\s*([•●▪◦‣∙·\-*–]|\d+[.)])\s+/;
const MONTH = "(?:jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec)[a-z]*\\.?";
const DATE = `(?:${MONTH}\\s+\\d{4}|\\d{1,2}/\\d{4}|\\d{4})`;
const RANGE = new RegExp(`(${DATE})\\s*(?:-|–|—|to)\\s*(${DATE}|present|current|now)`, "i");
const SINGLE_DATE = new RegExp(`\\b(${DATE})\\b`, "i");
const EMAIL = /[\w.+-]+@[\w-]+\.[\w.-]+/;
const PHONE = /(\+?\d[\d\s().-]{7,}\d)/;
const URL = /\b((?:https?:\/\/)?(?:www\.)?(?:linkedin\.com|github\.com|gitlab\.com|[\w-]+\.(?:dev|io|me|com))\/?[^\s,|]*)/gi;
const COMPANY_HINT = /\b(inc|llc|ltd|corp|corporation|gmbh|plc|co\.|company|technologies|labs|group|bank|university)\b/i;
const SCHOOL = /\b(university|college|institute|school|academy|polytechnic|universit[éày])\b/i;
const CITY_STATE = /^[A-Z][a-zA-Z .'-]+,\s*[A-Z][a-zA-Z .]+$/;
const DEGREE =/\b(bachelor|master|b\.?s\.?c?|m\.?s\.?c?|b\.?a\.?|m\.?a\.?|mba|ph\.?d|doctor|associate|diploma|b\.?eng|m\.?eng|b\.?tech|m\.?tech|hnd)\b/i;

function headingOf(line: string): Section | null {
  const clean = line.replace(/[:|]/g, "").trim().toLowerCase();
  if (clean.length > 40) return null;
  for (const [section, re] of HEADINGS) if (re.test(clean)) return section;
  return null;
}

function stripBullet(line: string) {
  return line.replace(BULLET, "").trim();
}

/** Re-join lines that PDF extraction wrapped mid-sentence. */
function unwrap(lines: string[]): string[] {
  const out: string[] = [];
  for (const line of lines) {
    const prev = out.at(-1);
    if (prev && BULLET.test(prev) && !BULLET.test(line) && /^[a-z(]/.test(line) && !headingOf(line)) {
      out[out.length - 1] = `${prev} ${line}`;
    } else out.push(line);
  }
  return out;
}

type Block = { header: string[]; bullets: string[] };

/** Group a section into entries: header lines followed by bullet lines. */
function blocks(lines: string[]): Block[] {
  const result: Block[] = [];
  let cur: Block | null = null;
  for (const line of lines) {
    const isBullet = BULLET.test(line);
    const startsNew = !isBullet && (!cur || cur.bullets.length > 0 || (RANGE.test(line) && cur.header.some((h) => RANGE.test(h))));
    if (startsNew) {
      cur = { header: [], bullets: [] };
      result.push(cur);
    }
    if (!cur) {
      cur = { header: [], bullets: [] };
      result.push(cur);
    }
    if (isBullet) cur.bullets.push(stripBullet(line));
    else if (cur.header.length >= 3 && !RANGE.test(line)) cur.bullets.push(line); // prose description
    else cur.header.push(line);
  }
  return result.filter((b) => b.header.length || b.bullets.length);
}

function splitDates(text: string): { rest: string; start: string; end: string } {
  const m = text.match(RANGE);
  if (m) return { rest: text.replace(m[0], "").replace(/[()]/g, ""), start: m[1], end: cap(m[2]) };
  const single = text.match(SINGLE_DATE);
  if (single) return { rest: text.replace(single[0], ""), start: single[1], end: single[1] };
  return { rest: text, start: "", end: "" };
}

function cap(s: string) {
  return /present|current|now/i.test(s) ? "Present" : s;
}

const SEP = /\s+(?:[|•·@]|—|–|-|,|at)\s+/i;

function parts(text: string) {
  return text
    .split(SEP)
    .map((p) => p.replace(/^[\s,|–—-]+|[\s,|–—-]+$/g, "").trim())
    .filter(Boolean);
}

function parseExperience(lines: string[]): Profile["experience"] {
  return blocks(lines).map((b) => {
    let start = "";
    let end = "";
    const fields: string[] = [];
    let location = "";
    for (const h of b.header) {
      const d = splitDates(h);
      if (d.start && !start) ({ start, end } = d);
      for (const p of parts(d.rest)) {
        // "City, ST" / "Remote" style tokens are locations, not titles.
        if (/^(remote|hybrid|on-?site)$/i.test(p) || /^[A-Z][a-z]+(?: [A-Z][a-z]+)*,\s*[A-Z]{2,}$/.test(p)) location ||= p;
        else fields.push(p);
      }
    }
    // "Senior Engineer, Acme Inc" on one line.
    if (fields.length === 1 && fields[0].includes(", ")) {
      const cut = fields[0].indexOf(", ");
      fields.splice(0, 1, fields[0].slice(0, cut), fields[0].slice(cut + 2));
    }
    let [title = "", company = ""] = fields;
    if (title && company && COMPANY_HINT.test(title) && !COMPANY_HINT.test(company)) [title, company] = [company, title];
    return {
      title,
      company,
      location: location || fields[2] || "",
      startDate: start,
      endDate: end,
      bullets: b.bullets,
    };
  }).filter((e) => e.title || e.company || e.bullets.length);
}

function parseEducation(lines: string[]): Profile["education"] {
  return blocks(lines).map((b) => {
    const header = b.header.join(" | ");
    const d = splitDates(header);
    const fields = parts(d.rest);
    const degreeIdx = fields.findIndex((f) => DEGREE.test(f));
    let degreeField = degreeIdx >= 0 ? fields[degreeIdx] : "";
    let institution = fields.filter((_, i) => i !== degreeIdx).join(", ");
    // "B.S. in Computer Science, University of X" on a single line.
    if (!institution && degreeField.includes(",")) {
      const cut = degreeField.indexOf(",");
      institution = degreeField.slice(cut + 1).trim();
      degreeField = degreeField.slice(0, cut);
    }
    let [degree, field = ""] = degreeField.split(/\s+(?:in|of)\s+/i);
    // "B.S., Computer Science, University of X": the piece before the school is the field.
    const instParts = institution.split(/,\s*/);
    if (!field && instParts.length > 1 && !SCHOOL.test(instParts[0]) && instParts.slice(1).some((p) => SCHOOL.test(p))) {
      field = instParts.shift()!;
      institution = instParts.join(", ");
    }
    degree = degree.trim();
    return {
      institution,
      degree: degree ?? "",
      field,
      startDate: d.start === d.end ? "" : d.start,
      endDate: d.end,
      details: b.bullets,
    };
  }).filter((e) => e.institution || e.degree);
}

function parseProjects(lines: string[]): Profile["projects"] {
  return blocks(lines).map((b) => {
    const [first = "", ...rest] = b.header;
    const [name, ...desc] = parts(first);
    const description = [...desc, ...rest].join(" ");
    const all = [first, ...rest, ...b.bullets].join(" ");
    return {
      name: name ?? "",
      description,
      technologies: extractSkillsFromText(all),
      bullets: b.bullets,
      link: all.match(URL)?.[0] ?? "",
    };
  }).filter((p) => p.name);
}

function parseSkills(rawLines: string[]): string[] {
  // Re-join a comma list that was wrapped across lines ("…, Unit" / "Testing, …").
  const lines: string[] = [];
  for (const line of rawLines) {
    const prev = lines.at(-1);
    if (prev && prev.includes(",") && !/[,;]$/.test(prev) && !/^[^,]{2,30}:/.test(line) && !BULLET.test(line)) {
      lines[lines.length - 1] = `${prev} ${line}`;
    } else lines.push(line);
  }
  return dedupeSkills(
    lines.flatMap((l) =>
      stripBullet(l)
        .replace(/^[^:]{2,30}:\s*/, "") // "Languages: Python, Go"
        .split(/\s*[,;|•·]\s*|\s{2,}|\s+\/\s+/)
        .map((s) => s.replace(/\.$/, "").trim())
        .filter((s) => s.length > 0 && s.length < 40),
    ),
  );
}

export function parseResumeHeuristic(text: string): Profile {
  const rawLines = text
    .replace(/\r/g, "")
    .split("\n")
    .map((l) => l.replace(/\s+/g, " ").trim())
    .filter((l) => l && !/^page \d+( of \d+)?$/i.test(l));
  const lines = unwrap(rawLines);

  const sections: Record<Section, string[]> = {
    header: [], summary: [], experience: [], education: [], skills: [],
    projects: [], certifications: [], achievements: [], other: [],
  };
  let current: Section = "header";
  for (const line of lines) {
    const h = headingOf(line);
    if (h) current = h;
    else sections[current].push(line);
  }

  const headerText = sections.header.join("\n");
  const name = sections.header.find((l) => !EMAIL.test(l) && !PHONE.test(l) && !/https?:|www\.|linkedin/i.test(l) && l.split(" ").length <= 5) ?? "";
  const nameIdx = sections.header.indexOf(name);
  const headline =
    sections.header.slice(nameIdx + 1).find((l) => !EMAIL.test(l) && !PHONE.test(l) && !URL.test(l) && l.length < 100) ?? "";
  URL.lastIndex = 0;

  const experience = parseExperience(sections.experience);
  const explicitSkills = parseSkills(sections.skills);
  const skills = dedupeSkills([...explicitSkills, ...extractSkillsFromText(text)]);

  return ProfileSchema.parse({
    name,
    email: headerText.match(EMAIL)?.[0] ?? text.match(EMAIL)?.[0] ?? "",
    phone: headerText.match(PHONE)?.[1]?.trim() ?? "",
    // Location may be its own line or one piece of a "email | phone | City, ST" line.
    location:
      sections.header
        .flatMap((l) => l.split(/\s+[|•·]\s+/))
        .map((p) => p.trim())
        .find((p) => CITY_STATE.test(p) && p !== name && !EMAIL.test(p)) ?? "",
    // Strip emails first so "jane@example.com" doesn't yield an "example.com" link.
    links: [...new Set(text.replace(new RegExp(EMAIL.source, "g"), " ").match(URL) ?? [])].slice(0, 5),
    headline: headline || experience[0]?.title || "",
    summary: sections.summary.join(" "),
    skills,
    experience,
    education: parseEducation(sections.education),
    projects: parseProjects(sections.projects),
    certifications: sections.certifications.map(stripBullet),
    achievements: sections.achievements.map(stripBullet),
  });
}
