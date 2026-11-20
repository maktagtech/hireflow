import "server-only";
import { createHash, randomBytes } from "node:crypto";
import bcrypt from "bcryptjs";
import { and, eq, gt, isNull, sql } from "drizzle-orm";
import { db, schema } from "@/db";
import { HttpError } from "./errors";

const TOKEN_TTL_MS = 60 * 60_000; // 1 hour

const hashToken = (token: string) => createHash("sha256").update(token).digest("hex");

/** Create a single-use reset token; returns the raw token (only ever sent by email). */
export async function createResetToken(userId: string): Promise<string> {
  const token = randomBytes(32).toString("base64url");
  // One live token per user: a new request invalidates older links.
  await db
    .update(schema.passwordResetTokens)
    .set({ usedAt: new Date() })
    .where(and(eq(schema.passwordResetTokens.userId, userId), isNull(schema.passwordResetTokens.usedAt)));
  await db.insert(schema.passwordResetTokens).values({
    userId,
    tokenHash: hashToken(token),
    expiresAt: new Date(Date.now() + TOKEN_TTL_MS),
  });
  return token;
}

/**
 * Consume a token and set the new password. Bumps the session version so every
 * existing session (including a stolen one) is signed out.
 */
export async function resetPassword(token: string, newPassword: string): Promise<{ userId: string; sessionVersion: number }> {
  const passwordHash = await bcrypt.hash(newPassword, 12);
  return db.transaction(async (tx) => {
    const [row] = await tx
      .update(schema.passwordResetTokens)
      .set({ usedAt: new Date() })
      .where(
        and(
          eq(schema.passwordResetTokens.tokenHash, hashToken(token)),
          isNull(schema.passwordResetTokens.usedAt),
          gt(schema.passwordResetTokens.expiresAt, new Date()),
        ),
      )
      .returning({ userId: schema.passwordResetTokens.userId });
    if (!row) throw new HttpError(400, "This reset link is invalid or has expired. Request a new one.");
    return setPassword(tx, row.userId, passwordHash);
  });
}

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

export async function setPassword(tx: Tx | typeof db, userId: string, passwordHash: string) {
  const [user] = await tx
    .update(schema.users)
    .set({ passwordHash, sessionVersion: sql`${schema.users.sessionVersion} + 1` })
    .where(eq(schema.users.id, userId))
    .returning({ userId: schema.users.id, sessionVersion: schema.users.sessionVersion });
  return user;
}
