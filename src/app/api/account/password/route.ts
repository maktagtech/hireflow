import bcrypt from "bcryptjs";
import { z } from "zod";
import { db } from "@/db";
import { HttpError, handler, json } from "@/lib/api";
import { verifyPassword } from "@/lib/account";
import { requireUser, startSession } from "@/lib/auth";
import { setPassword } from "@/lib/password-reset";
import { rateLimit } from "@/lib/rate-limit";

const Body = z.object({
  currentPassword: z.string().min(1).max(200),
  newPassword: z.string().min(8, "New password must be at least 8 characters").max(200),
});

/** Change password. Signs out every other session; this one gets a fresh token. */
export const POST = handler(async (req: Request) => {
  const user = await requireUser();
  rateLimit(`change-password:${user.id}`, 10, 15 * 60_000);
  const { currentPassword, newPassword } = Body.parse(await req.json());
  if (currentPassword === newPassword) throw new HttpError(400, "Choose a password different from your current one");
  await verifyPassword(user.id, currentPassword);
  const { sessionVersion } = await setPassword(db, user.id, await bcrypt.hash(newPassword, 12));
  await startSession(user.id, sessionVersion);
  return json({ ok: true });
});
