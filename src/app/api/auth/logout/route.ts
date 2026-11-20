import { handler, json } from "@/lib/api";
import { endSession } from "@/lib/auth";

export const POST = handler(async () => {
  await endSession();
  return json({ ok: true });
});
