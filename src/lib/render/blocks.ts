import type { CoverLetter, Profile } from "@/lib/types";

/**
 * Format-neutral document model. Both the DOCX and PDF renderers consume this,
 * so the two downloads always contain identical content. The vocabulary is
 * intentionally small: ATS parsers handle a single column of headings,
 * paragraphs and bullets best (no tables, columns, icons or text boxes).
 */
export type Block =
  | { type: "name"; text: string }
  | { type: "contact"; text: string }
  | { type: "headline"; text: string }
  | { type: "heading"; text: string }
  | { type: "paragraph"; text: string }
  | { type: "entry"; left: string; right: string; sub?: string }
  | { type: "bullet"; text: string }
  | { type: "spacer" };

export function resumeBlocks(p: Profile): Block[] {
  const out: Block[] = [];
  out.push({ type: "name", text: p.name || "Your Name" });
  const contact = [p.email, p.phone, p.location, ...p.links].filter(Boolean).join("  |  ");
  if (contact) out.push({ type: "contact", text: contact });
  if (p.headline) out.push({ type: "headline", text: p.headline });

  if (p.summary) {
    out.push({ type: "heading", text: "Professional Summary" }, { type: "paragraph", text: p.summary });
  }
  if (p.skills.length) {
    out.push({ type: "heading", text: "Skills" }, { type: "paragraph", text: p.skills.join(", ") });
  }
  if (p.experience.length) {
    out.push({ type: "heading", text: "Professional Experience" });
    p.experience.forEach((e, i) => {
      if (i > 0) out.push({ type: "spacer" });
      out.push({
        type: "entry",
        left: [e.title, e.company].filter(Boolean).join(", "),
        right: dateRange(e.startDate, e.endDate),
        sub: e.location || undefined,
      });
      for (const b of e.bullets) out.push({ type: "bullet", text: b });
    });
  }
  if (p.projects.length) {
    out.push({ type: "heading", text: "Projects" });
    p.projects.forEach((pr, i) => {
      if (i > 0) out.push({ type: "spacer" });
      out.push({
        type: "entry",
        left: pr.name,
        right: "",
        sub: pr.technologies.length ? `Technologies: ${pr.technologies.join(", ")}` : undefined,
      });
      if (pr.description) out.push({ type: "paragraph", text: pr.description });
      for (const b of pr.bullets) out.push({ type: "bullet", text: b });
    });
  }
  if (p.education.length) {
    out.push({ type: "heading", text: "Education" });
    for (const e of p.education) {
      const degree = [e.degree, e.field].filter(Boolean).join(", ");
      out.push({
        type: "entry",
        left: [degree, e.institution].filter(Boolean).join(", "),
        right: dateRange(e.startDate, e.endDate),
      });
      for (const d of e.details) out.push({ type: "bullet", text: d });
    }
  }
  if (p.certifications.length) {
    out.push({ type: "heading", text: "Certifications" });
    for (const c of p.certifications) out.push({ type: "bullet", text: c });
  }
  if (p.achievements.length) {
    out.push({ type: "heading", text: "Achievements" });
    for (const a of p.achievements) out.push({ type: "bullet", text: a });
  }
  return out;
}

export function coverLetterBlocks(p: Profile, letter: CoverLetter, date = new Date()): Block[] {
  const out: Block[] = [{ type: "name", text: p.name || "Your Name" }];
  const contact = [p.email, p.phone, p.location].filter(Boolean).join("  |  ");
  if (contact) out.push({ type: "contact", text: contact });
  out.push(
    { type: "spacer" },
    { type: "paragraph", text: date.toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" }) },
    { type: "spacer" },
    { type: "paragraph", text: letter.greeting },
  );
  for (const para of letter.paragraphs) out.push({ type: "spacer" }, { type: "paragraph", text: para });
  out.push({ type: "spacer" }, { type: "paragraph", text: letter.closing }, { type: "paragraph", text: p.name });
  return out;
}

function dateRange(start: string, end: string) {
  if (start && end && start !== end) return `${start} – ${end}`;
  return start || end || "";
}
