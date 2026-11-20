import { z } from "zod";
import { handler, json } from "@/lib/api";
import { startSession } from "@/lib/auth";
import { resetPassword } from "@/lib/password-reset";
import { rateLimit } from "@/lib/rate-limit";

const Body = z.object({
  token: z.string().min(20).max(200),
  password: z.string().min(8, "Password must be at least 8 characters").max(200),
});

export const POST = handler(async (req: Request) => {
  rateLimit(`reset:${req.headers.get("x-forwarded-for") ?? "local"}`, 20, 60 * 60_000);
  const { token, password } = Body.parse(await req.json());
  const { userId, sessionVersion } = await resetPassword(token, password);
  // Sign the user in with a fresh session; all older sessions are now invalid.
  await startSession(userId, sessionVersion);
  return json({ ok: true });
});
