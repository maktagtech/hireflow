import { eq } from "drizzle-orm";
import { z } from "zod";
import { db, schema } from "@/db";
import { handler, json } from "@/lib/api";
import { site } from "@/lib/config";
import { appUrl, sendEmail } from "@/lib/email";
import { createResetToken } from "@/lib/password-reset";
import { rateLimit } from "@/lib/rate-limit";

const Body = z.object({ email: z.string().max(320).transform((e) => e.toLowerCase().trim()) });

/**
 * Always responds the same way whether or not the account exists, so this
 * endpoint can't be used to discover registered emails.
 */
export const POST = handler(async (req: Request) => {
  const { email } = Body.parse(await req.json());
  rateLimit(`forgot:ip:${req.headers.get("x-forwarded-for") ?? "local"}`, 10, 60 * 60_000);
  rateLimit(`forgot:email:${email}`, 3, 60 * 60_000);

  const [user] = await db
    .select({ id: schema.users.id, name: schema.users.name })
    .from(schema.users)
    .where(eq(schema.users.email, email));
  if (user) {
    const token = await createResetToken(user.id);
    const link = `${appUrl(req)}/reset-password?token=${token}`;
    try {
      await sendEmail({
        to: email,
        subject: `Reset your ${site.name} password`,
        text: `Hi${user.name ? ` ${user.name.split(" ")[0]}` : ""},\n\nSomeone (hopefully you) asked to reset your ${site.name} password. Use this link within the next hour:\n\n${link}\n\nIf you didn't request this, you can ignore this email — your password won't change.`,
      });
    } catch (err) {
      // Don't reveal delivery failures to the requester; log for the operator.
      console.error("[forgot-password] email failed:", err);
    }
  }
  return json({ ok: true });
});
