import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { scoreMatch, totalYears } from "@/lib/match/score";
import { canonicalSkill, extractSkillsFromText, replaceAliases, textMentionsSkill } from "@/lib/match/skills";
import { applyTailoring, tailorOffline } from "@/lib/match/tailor";
import { TruthGuard } from "@/lib/match/truth";
import { coverLetterOffline } from "@/lib/match/cover-letter";
import { parseResumeHeuristic } from "@/lib/parse/resume-heuristic";
import { detectAlternatives, parseJobHeuristic } from "@/lib/parse/job";
import { resumeBlocks, coverLetterBlocks } from "@/lib/render/blocks";
import { renderPdf } from "@/lib/render/pdf";
import { renderDocx } from "@/lib/render/docx";
import { extractText } from "@/lib/parse/extract-text";

const fixture = (f: string) => readFileSync(path.join(__dirname, "fixtures", f), "utf8");
const NOW = new Date("2026-11-01");

describe("skills", () => {
  it("normalizes aliases and avoids substring false positives", () => {
    expect(canonicalSkill("k8s")).toBe("Kubernetes");
    expect(canonicalSkill("postgres")).toBe("PostgreSQL");
    expect(extractSkillsFromText("Built apps in JavaScript")).not.toContain("Java");
    expect(extractSkillsFromText("C# and C++ services on .NET")).toEqual(expect.arrayContaining(["C#", "C++", ".NET"]));
    expect(extractSkillsFromText("Maintained CI/CD with GitHub Actions")).toEqual(expect.arrayContaining(["CI/CD", "GitHub Actions"]));
  });

  it("counts implied skills as evidence but never rewrites them", () => {
    expect(textMentionsSkill("Ran daily Scrum ceremonies", "Agile")).toBe(true);
    expect(replaceAliases("Ran daily Scrum ceremonies", "Agile")).toBe("Ran daily Scrum ceremonies");
    expect(replaceAliases("Tuned postgres queries", "PostgreSQL")).toBe("Tuned PostgreSQL queries");
  });
});

describe("heuristic parsers", () => {
  const profile = parseResumeHeuristic(fixture("resume.txt"));
  const job = parseJobHeuristic(fixture("job.txt"));

  it("parses the resume into a structured profile", () => {
    expect(profile.name).toBe("Jane Doe");
    expect(profile.email).toBe("jane.doe@example.com");
    expect(profile.experience).toHaveLength(2);
    expect(profile.experience[0]).toMatchObject({
      title: "Senior Software Engineer",
      company: "Acme Payments Inc",
      startDate: "Jan 2021",
      endDate: "Present",
    });
    expect(profile.experience[0].bullets).toHaveLength(4);
    expect(profile.education[0]).toMatchObject({ degree: "B.S.", field: "Computer Science", institution: "University of California, Berkeley" });
    expect(profile.location).toBe("San Francisco, CA");
    expect(profile.skills).toEqual(expect.arrayContaining(["Python", "AWS", "Docker", "PostgreSQL"]));
    expect(profile.certifications).toHaveLength(1);
  });

  it("parses the job description", () => {
    expect(job.title).toBe("Senior Backend Engineer");
    expect(job.company).toBe("Northwind Cloud");
    expect(job.minYearsExperience).toBe(5);
    expect(job.experienceLevel).toBe("senior");
    expect(job.skills).toEqual(expect.arrayContaining(["Python", "AWS", "Kubernetes", "Terraform", "CI/CD"]));
    expect(job.requirements.length).toBeGreaterThanOrEqual(6);
    expect(job.responsibilities.length).toBe(3);
  });

  it("treats 'X or Y' skills as alternatives", () => {
    expect(detectAlternatives("Experience with FastAPI or Django")).toEqual([["FastAPI", "Django"]]);
    expect(detectAlternatives("AWS, GCP, or Azure experience")).toEqual([["AWS", "GCP", "Azure"]]);
    expect(detectAlternatives("Hands-on AWS and Docker or similar")).toEqual([]);
    const score = scoreMatch(profile, job, NOW);
    expect(score.missingSkills).not.toContain("Django");
    expect(score.matchedSkills).toContain("FastAPI");
  });

  it("extracts meaningful keywords, not generic words", () => {
    expect(job.keywords).toEqual(expect.arrayContaining(["payments platform", "code review"]));
    for (const generic of ["code", "design", "services", "end"]) expect(job.keywords).not.toContain(generic);
  });

  it("computes merged years of experience", () => {
    expect(totalYears(profile, NOW)).toBeCloseTo(9.4, 0);
  });

  it("scores deterministically and reports the real gaps", () => {
    const a = scoreMatch(profile, job, NOW);
    const b = scoreMatch(profile, job, NOW);
    expect(a).toEqual(b);
    expect(a.missingSkills).toEqual(expect.arrayContaining(["Kubernetes", "Terraform"]));
    expect(a.matchedSkills).toEqual(expect.arrayContaining(["Python", "AWS", "Docker", "CI/CD"]));
    expect(a.overall).toBeGreaterThan(0);
    expect(a.overall).toBeLessThanOrEqual(100);
  });

  it("offline tailoring never adds missing skills and never lowers the score", () => {
    const before = scoreMatch(profile, job, NOW);
    const { profile: tailored } = tailorOffline(profile, job, before);
    const after = scoreMatch(tailored, job, NOW);
    expect(after.overall).toBeGreaterThanOrEqual(before.overall);
    const text = JSON.stringify(tailored);
    expect(text).not.toMatch(/Kubernetes|Terraform/);
    expect(tailored.experience[0].bullets.join(" ")).toContain("PostgreSQL"); // alias aligned
  });

  it("doesn't mistake the email domain for a link", () => {
    expect(profile.links).toEqual(["linkedin.com/in/janedoe"]);
  });

  it("cover letter is grounded in the profile", () => {
    const letter = coverLetterOffline(profile, job, scoreMatch(profile, job, NOW));
    const body = letter.paragraphs.join(" ");
    expect(body).toContain("at Northwind Cloud");
    expect(body).not.toMatch(/\bour\b|postgres\b/);
    expect(letter.paragraphs.join(" ")).not.toMatch(/Kubernetes|Terraform/);
    expect(new TruthGuard(profile).violations(letter.paragraphs.join(" "))).toEqual([]);
  });
});

describe("truth guard", () => {
  const profile = parseResumeHeuristic(fixture("resume.txt"));
  const job = parseJobHeuristic(fixture("job.txt"));
  const score = scoreMatch(profile, job, NOW);
  const original = profile.experience[0].bullets[0];

  it("accepts a truthful rewrite", () => {
    const r = applyTailoring(profile, job, score, {
      headline: "Senior Backend Engineer",
      summary: "Backend engineer building AWS cloud services in Python.",
      rewrites: [{ experienceIndex: 0, bulletIndex: 0, original, rewritten: "Built scalable AWS-based payment services supporting 2M users" }],
    });
    expect(r.tailoring.rewrites).toHaveLength(1);
    expect(r.rejected).toHaveLength(0);
  });

  it("rejects invented skills, invented metrics and hallucinated indices", () => {
    const r = applyTailoring(profile, job, score, {
      headline: profile.headline,
      summary: "Expert in Kubernetes and Terraform.",
      rewrites: [
        { experienceIndex: 0, bulletIndex: 0, original, rewritten: "Built AWS cloud solutions on Kubernetes for 2M users" },
        { experienceIndex: 0, bulletIndex: 0, original, rewritten: "Built AWS cloud solutions for 9M users, saving $3M" },
        { experienceIndex: 7, bulletIndex: 0, original: "nope", rewritten: "Did things" },
      ],
    });
    expect(r.tailoring.rewrites).toHaveLength(0);
    expect(r.rejected.map((x) => x.reasons.join())).toEqual(
      expect.arrayContaining([expect.stringContaining("Kubernetes"), expect.stringContaining("9m")]),
    );
    expect(r.profile.summary).not.toMatch(/Kubernetes/);
    expect(r.profile.experience[0].bullets).toContain(original);
  });
});

describe("renderers", () => {
  const profile = parseResumeHeuristic(fixture("resume.txt"));

  it.each(["pdf", "docx"] as const)("round-trips a generated %s through the parser", async (kind) => {
    const blocks = resumeBlocks(profile);
    const bytes = kind === "pdf" ? await renderPdf(blocks, { title: "t" }) : await renderDocx(blocks, { title: "t" });
    const reparsed = parseResumeHeuristic(await extractText(kind, new Uint8Array(bytes)));
    expect(reparsed.name).toBe("Jane Doe");
    expect(reparsed.experience.map((e) => [e.title, e.company, e.bullets.length])).toEqual([
      ["Senior Software Engineer", "Acme Payments Inc", 4],
      ["Software Engineer", "Blue Labs", 3],
    ]);
    expect(reparsed.education[0]).toMatchObject({
      degree: "B.S.",
      field: "Computer Science",
      institution: "University of California, Berkeley",
    });
    expect(reparsed.location).toBe("San Francisco, CA");
    expect(reparsed.links).toEqual(["linkedin.com/in/janedoe"]);
    expect(reparsed.skills).toContain("Unit Testing");
    expect(reparsed.skills).not.toContain("Unit");
  });

  it("produces valid PDF and DOCX files", async () => {
    const pdf = await renderPdf(resumeBlocks({ ...profile, summary: "Uses → arrows and “quotes” 🚀" }), { title: "t" });
    expect(pdf.subarray(0, 5).toString()).toBe("%PDF-");
    const docx = await renderDocx(coverLetterBlocks(profile, { greeting: "Hi,", paragraphs: ["p"], closing: "Bye," }), { title: "t" });
    expect(docx.subarray(0, 2).toString()).toBe("PK");
  });
});
