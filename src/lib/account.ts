import "server-only";
import bcrypt from "bcryptjs";
import { eq } from "drizzle-orm";
import { db, schema } from "@/db";
import { HttpError } from "./errors";
import { getStorage } from "./storage";

export async function verifyPassword(userId: string, password: string) {
  const [user] = await db
    .select({ hash: schema.users.passwordHash })
    .from(schema.users)
    .where(eq(schema.users.id, userId));
  if (!user || !(await bcrypt.compare(password, user.hash))) throw new HttpError(403, "Incorrect password");
}

/** Everything we hold about a user, for the "download my data" export. */
export async function exportAccount(userId: string) {
  const [user] = await db
    .select({
      email: schema.users.email,
      name: schema.users.name,
      createdAt: schema.users.createdAt,
      acceptedTermsAt: schema.users.acceptedTermsAt,
    })
    .from(schema.users)
    .where(eq(schema.users.id, userId));
  const [profile] = await db.select().from(schema.profiles).where(eq(schema.profiles.userId, userId));
  const jobs = await db.select().from(schema.jobs).where(eq(schema.jobs.userId, userId));
  const generated = await db.select().from(schema.generatedResumes).where(eq(schema.generatedResumes.userId, userId));
  return {
    exportedAt: new Date().toISOString(),
    account: user,
    masterProfile: profile?.profileData ?? null,
    applications: jobs.map((j) => {
      const docs = generated.filter((g) => g.jobId === j.id);
      return {
        title: j.jobTitle,
        company: j.company,
        url: j.url,
        status: j.status,
        createdAt: j.createdAt,
        appliedAt: j.appliedAt,
        jobDescription: j.jobDescription,
        parsedJob: j.parsed,
        generated: docs.map((g) => ({
          version: g.resumeVersion,
          createdAt: g.createdAt,
          atsScore: g.atsScore,
          baselineScore: g.baselineScore,
          tailoredResume: g.tailoredProfile,
          coverLetter: g.coverLetter,
          changes: g.tailoring,
        })),
      };
    }),
  };
}

/**
 * Permanently delete an account: stored files first (so a failure leaves the
 * account intact and retryable), then the user row, which cascades to the
 * profile, jobs, generated documents and reset tokens.
 */
export async function deleteAccount(userId: string) {
  await getStorage().deletePrefix(`users/${userId}/`);
  await db.delete(schema.users).where(eq(schema.users.id, userId));
}
