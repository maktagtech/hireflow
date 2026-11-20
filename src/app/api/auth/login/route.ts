import bcrypt from "bcryptjs";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { db, schema } from "@/db";
import { HttpError, handler, json } from "@/lib/api";
import { startSession } from "@/lib/auth";
import { rateLimit } from "@/lib/rate-limit";

const Body = z.object({
  email: z.string().transform((e) => e.toLowerCase().trim()),
  password: z.string().min(1).max(200),
});

// Compared against when the email is unknown, so response time doesn't reveal accounts.
let dummyHash: string | undefined;
const getDummyHash = () => (dummyHash ??= bcrypt.hashSync("not-a-real-password", 12));

export const POST = handler(async (req: Request) => {
  const { email, password } = Body.parse(await req.json());
  rateLimit(`login:${email}`, 10, 15 * 60_000);
  const [user] = await db
    .select({ id: schema.users.id, hash: schema.users.passwordHash, version: schema.users.sessionVersion })
    .from(schema.users)
    .where(eq(schema.users.email, email));
  const ok = await bcrypt.compare(password, user?.hash ?? getDummyHash());
  if (!user || !ok) throw new HttpError(401, "Incorrect email or password");
  await startSession(user.id, user.version);
  return json({ ok: true });
});
