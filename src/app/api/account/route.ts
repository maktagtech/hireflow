import { z } from "zod";
import { handler, json } from "@/lib/api";
import { deleteAccount, verifyPassword } from "@/lib/account";
import { endSession, requireUser } from "@/lib/auth";
import { rateLimit } from "@/lib/rate-limit";

const DeleteBody = z.object({
  password: z.string().min(1, "Enter your password").max(200),
  confirm: z.literal("DELETE", 'Type "DELETE" to confirm'),
});

/** Permanently delete the signed-in user's account and all their data. */
export const DELETE = handler(async (req: Request) => {
  const user = await requireUser();
  rateLimit(`delete-account:${user.id}`, 5, 15 * 60_000);
  const { password } = DeleteBody.parse(await req.json());
  await verifyPassword(user.id, password);
  await deleteAccount(user.id);
  await endSession();
  return json({ ok: true });
});
