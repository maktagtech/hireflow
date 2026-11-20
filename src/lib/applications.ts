import "server-only";
import { and, desc, eq } from "drizzle-orm";
import { db, schema } from "@/db";
import { HttpError } from "./api";

/** Data access for a user's applications. Every query is scoped by userId. */

export async function listApplications(userId: string) {
  const jobs = await db
    .select()
    .from(schema.jobs)
    .where(eq(schema.jobs.userId, userId))
    .orderBy(desc(schema.jobs.createdAt));
  const generated = await db
    .select({
      jobId: schema.generatedResumes.jobId,
      atsScore: schema.generatedResumes.atsScore,
      baselineScore: schema.generatedResumes.baselineScore,
      version: schema.generatedResumes.resumeVersion,
    })
    .from(schema.generatedResumes)
    .where(eq(schema.generatedResumes.userId, userId));
  const latest = new Map<string, (typeof generated)[number]>();
  for (const g of generated) {
    const cur = latest.get(g.jobId);
    if (!cur || g.version > cur.version) latest.set(g.jobId, g);
  }
  return jobs.map((j) => ({
    id: j.id,
    title: j.jobTitle,
    company: j.company,
    url: j.url,
    status: j.status,
    createdAt: j.createdAt,
    appliedAt: j.appliedAt,
    score: latest.get(j.id)?.atsScore.overall ?? null,
    baseline: latest.get(j.id)?.baselineScore.overall ?? null,
  }));
}

export async function getApplication(userId: string, jobId: string) {
  if (!/^[0-9a-f-]{36}$/i.test(jobId)) throw new HttpError(404, "Application not found");
  const [job] = await db
    .select()
    .from(schema.jobs)
    .where(and(eq(schema.jobs.id, jobId), eq(schema.jobs.userId, userId)));
  if (!job) throw new HttpError(404, "Application not found");
  const [generated] = await db
    .select()
    .from(schema.generatedResumes)
    .where(eq(schema.generatedResumes.jobId, job.id))
    .orderBy(desc(schema.generatedResumes.resumeVersion))
    .limit(1);
  return { job, generated: generated ?? null };
}
