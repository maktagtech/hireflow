import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { db, schema } from "@/db";
import { handler, json } from "@/lib/api";
import { getApplication } from "@/lib/applications";
import { requireUser } from "@/lib/auth";
import { getStorage } from "@/lib/storage";
import { APPLICATION_STATUSES } from "@/lib/types";

export const GET = handler(async (_req: Request, ctx: RouteContext<"/api/applications/[id]">) => {
  const user = await requireUser();
  const { id } = await ctx.params;
  const { job, generated } = await getApplication(user.id, id);
  return json({
    job: {
      id: job.id,
      title: job.jobTitle,
      company: job.company,
      url: job.url,
      status: job.status,
      createdAt: job.createdAt,
      parsed: job.parsed,
    },
    result: generated && {
      version: generated.resumeVersion,
      score: generated.atsScore,
      baseline: generated.baselineScore,
      tailoring: generated.tailoring,
      resume: generated.tailoredProfile,
      coverLetter: generated.coverLetter,
      aiProvider: generated.aiProvider,
      createdAt: generated.createdAt,
    },
  });
});

const Patch = z.object({ status: z.enum(APPLICATION_STATUSES) });

/** Track the outcome — this feeds the interview-rate metric. */
export const PATCH = handler(async (req: Request, ctx: RouteContext<"/api/applications/[id]">) => {
  const user = await requireUser();
  const { id } = await ctx.params;
  const { job } = await getApplication(user.id, id);
  const { status } = Patch.parse(await req.json());
  await db
    .update(schema.jobs)
    .set({ status, appliedAt: status === "generated" ? null : (job.appliedAt ?? new Date()) })
    .where(and(eq(schema.jobs.id, job.id), eq(schema.jobs.userId, user.id)));
  return json({ ok: true, status });
});

export const DELETE = handler(async (_req: Request, ctx: RouteContext<"/api/applications/[id]">) => {
  const user = await requireUser();
  const { id } = await ctx.params;
  const { job } = await getApplication(user.id, id);
  await db.delete(schema.jobs).where(and(eq(schema.jobs.id, job.id), eq(schema.jobs.userId, user.id)));
  // Generated PDFs/DOCX for this application live under its own prefix.
  await getStorage().deletePrefix(`users/${user.id}/jobs/${job.id}/`);
  return json({ ok: true });
});
