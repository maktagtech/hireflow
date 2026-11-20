import "server-only";
import { and, count, eq } from "drizzle-orm";
import { db, schema } from "@/db";
import { AIProviderError, getAI } from "./ai";
import { HttpError } from "./api";
import { coverLetterOffline, coverLetterWithAI } from "./match/cover-letter";
import { scoreMatch } from "./match/score";
import { tailorOffline, tailorWithAI, type TailorResult } from "./match/tailor";
import { importJob } from "./parse/job";
import { coverLetterBlocks, resumeBlocks } from "./render/blocks";
import { renderDocx } from "./render/docx";
import { renderPdf } from "./render/pdf";
import { getStorage } from "./storage";
import type { CoverLetter } from "./types";

const PDF = "application/pdf";
const DOCX = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";

/**
 * The one-click flow: job URL/text in → tailored resume + cover letter
 * (PDF and DOCX) + ATS score out, persisted as one application.
 */
export async function optimize(userId: string, input: { url?: string; text?: string }) {
  const [profileRow] = await db
    .select()
    .from(schema.profiles)
    .where(eq(schema.profiles.userId, userId))
    .limit(1);
  if (!profileRow) throw new HttpError(409, "Upload your master resume first.");
  const profile = profileRow.profileData;

  const { job, description, url } = await importJob(input);
  const baseline = scoreMatch(profile, job);

  // Tailoring and the cover letter are independent — run them concurrently.
  // If the AI provider fails, fall back to the deterministic engine so the user
  // still gets a complete package.
  const ai = getAI();
  let provider = ai?.name ?? "offline";
  const withFallback = async <T>(aiFn: () => Promise<T>, offline: () => T): Promise<T> => {
    if (!ai) return offline();
    try {
      return await aiFn();
    } catch (err) {
      if (!(err instanceof AIProviderError)) throw err;
      console.error(`[ai:${err.provider}] falling back to offline engine:`, err.message);
      provider = `${ai.name}+offline`;
      return offline();
    }
  };
  const [tailored, coverLetter] = await Promise.all([
    withFallback<TailorResult>(
      () => tailorWithAI(ai!, profile, job, baseline),
      () => tailorOffline(profile, job, baseline),
    ),
    withFallback<CoverLetter>(
      () => coverLetterWithAI(ai!, profile, job, baseline),
      () => coverLetterOffline(profile, job, baseline),
    ),
  ]);
  const score = scoreMatch(tailored.profile, job);

  // Persist the job first so generated files are keyed under it.
  const [jobRow] = await db
    .insert(schema.jobs)
    .values({
      userId,
      jobTitle: job.title,
      company: job.company,
      jobDescription: description,
      url,
      parsed: job,
    })
    .returning({ id: schema.jobs.id });

  const [{ value: priorVersions }] = await db
    .select({ value: count() })
    .from(schema.generatedResumes)
    .where(and(eq(schema.generatedResumes.userId, userId), eq(schema.generatedResumes.jobId, jobRow.id)));
  const version = priorVersions + 1;

  const title = `${profile.name || "Resume"} – ${job.title || "Application"}`;
  const resume = resumeBlocks(tailored.profile);
  const letter = coverLetterBlocks(profile, coverLetter);
  const [resumePdf, resumeDocx, letterPdf, letterDocx] = await Promise.all([
    renderPdf(resume, { title }),
    renderDocx(resume, { title }),
    renderPdf(letter, { title: `Cover Letter – ${title}`, centerHeader: false }),
    renderDocx(letter, { title: `Cover Letter – ${title}`, centerHeader: false }),
  ]);

  const base = `users/${userId}/jobs/${jobRow.id}/v${version}`;
  const keys = {
    pdf: `${base}/resume.pdf`,
    docx: `${base}/resume.docx`,
    letterPdf: `${base}/cover-letter.pdf`,
    letterDocx: `${base}/cover-letter.docx`,
  };
  const storage = getStorage();
  await Promise.all([
    storage.put(keys.pdf, resumePdf, PDF),
    storage.put(keys.docx, resumeDocx, DOCX),
    storage.put(keys.letterPdf, letterPdf, PDF),
    storage.put(keys.letterDocx, letterDocx, DOCX),
  ]);

  await db.insert(schema.generatedResumes).values({
    userId,
    jobId: jobRow.id,
    resumeVersion: version,
    pdfUrl: keys.pdf,
    docxUrl: keys.docx,
    coverLetterPdfUrl: keys.letterPdf,
    coverLetterDocxUrl: keys.letterDocx,
    atsScore: score,
    baselineScore: baseline,
    tailoring: tailored.tailoring,
    tailoredProfile: tailored.profile,
    coverLetter,
    aiProvider: provider,
  });

  return { applicationId: jobRow.id, score, baseline };
}
