import "server-only";
import { randomBytes } from "node:crypto";
import { and, eq, sql } from "drizzle-orm";
import { db, schema } from "@/db";
import { HttpError } from "./errors";

export function inviteOnly(): boolean {
  return process.env.BETA_INVITE_ONLY === "true";
}

/** Human-friendly code, e.g. "HF-7K3Q-M9XD". No 0/O/1/I to avoid typos. */
export function generateInviteCode(): string {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const bytes = randomBytes(8);
  const chars = [...bytes].map((b) => alphabet[b % alphabet.length]);
  return `HF-${chars.slice(0, 4).join("")}-${chars.slice(4).join("")}`;
}

export async function createInvite(opts: { email?: string; maxUses?: number; note?: string; expiresInDays?: number }) {
  const [invite] = await db
    .insert(schema.invites)
    .values({
      code: generateInviteCode(),
      email: opts.email?.toLowerCase().trim() || null,
      maxUses: opts.maxUses ?? 1,
      note: opts.note ?? "",
      expiresAt: opts.expiresInDays ? new Date(Date.now() + opts.expiresInDays * 86_400_000) : null,
    })
    .returning();
  return invite;
}

/**
 * Atomically consume one use of an invite for this email. Runs inside the
 * signup transaction so a failed signup doesn't burn the invite.
 */
export async function redeemInvite(tx: Parameters<Parameters<typeof db.transaction>[0]>[0], code: string, email: string) {
  const normalized = code.trim().toUpperCase();
  const [invite] = await tx
    .update(schema.invites)
    .set({ uses: sql`${schema.invites.uses} + 1` })
    .where(
      and(
        eq(schema.invites.code, normalized),
        sql`${schema.invites.uses} < ${schema.invites.maxUses}`,
        sql`(${schema.invites.expiresAt} IS NULL OR ${schema.invites.expiresAt} > now())`,
        sql`(${schema.invites.email} IS NULL OR ${schema.invites.email} = ${email})`,
      ),
    )
    .returning({ id: schema.invites.id });
  if (!invite) throw new HttpError(403, "That invite code isn't valid for this email (it may be used up or expired).");
}
