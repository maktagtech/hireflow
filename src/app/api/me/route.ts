import { eq } from "drizzle-orm";
import { db, schema } from "@/db";
import { handler, json } from "@/lib/api";
import { requireUser } from "@/lib/auth";
import { getAI } from "@/lib/ai";

export const GET = handler(async () => {
  const user = await requireUser();
  const [profile] = await db
    .select({ id: schema.profiles.id })
    .from(schema.profiles)
    .where(eq(schema.profiles.userId, user.id));
  const ai = getAI();
  return json({ user, hasProfile: !!profile, ai: ai ? `${ai.name} (${ai.model})` : "offline" });
});
