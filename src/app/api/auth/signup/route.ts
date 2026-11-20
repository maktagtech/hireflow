import bcrypt from "bcryptjs";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { db, schema } from "@/db";
import { HttpError, handler, json } from "@/lib/api";
import { startSession } from "@/lib/auth";
import { inviteOnly, redeemInvite } from "@/lib/invites";
import { rateLimit } from "@/lib/rate-limit";

const Body = z.object({
  name: z.string().trim().max(100).default(""),
  email: z.email("Enter a valid email").transform((e) => e.toLowerCase().trim()),
  password: z.string().min(8, "Password must be at least 8 characters").max(200),
  inviteCode: z.string().trim().max(40).optional(),
  acceptTerms: z.literal(true, "Please accept the Terms and Privacy Policy to continue"),
});

/** Public signup settings for the form. */
export const GET = handler(async () => json({ inviteOnly: inviteOnly() }));

export const POST = handler(async (req: Request) => {
  rateLimit(`signup:${req.headers.get("x-forwarded-for") ?? "local"}`, 10, 60 * 60_000);
  const { name, email, password, inviteCode } = Body.parse(await req.json());
  if (inviteOnly() && !inviteCode) throw new HttpError(403, "HireFlow is invite-only during the beta. Enter your invite code.");

  const [existing] = await db.select({ id: schema.users.id }).from(schema.users).where(eq(schema.users.email, email));
  if (existing) throw new HttpError(409, "An account with this email already exists");

  const passwordHash = await bcrypt.hash(password, 12);
  const user = await db.transaction(async (tx) => {
    if (inviteOnly()) await redeemInvite(tx, inviteCode!, email);
    const [created] = await tx
      .insert(schema.users)
      .values({ name, email, passwordHash, acceptedTermsAt: new Date() })
      .returning({ id: schema.users.id, sessionVersion: schema.users.sessionVersion });
    return created;
  });
  await startSession(user.id, user.sessionVersion);
  return json({ ok: true }, 201);
});
