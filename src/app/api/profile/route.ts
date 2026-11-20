import { eq } from "drizzle-orm";
import { db, schema } from "@/db";
import { handler, json } from "@/lib/api";
import { requireUser } from "@/lib/auth";
import { dedupeSkills } from "@/lib/match/skills";
import { ProfileSchema } from "@/lib/types";

export const GET = handler(async () => {
  const user = await requireUser();
  const [row] = await db.select().from(schema.profiles).where(eq(schema.profiles.userId, user.id));
  return json({ profile: row?.profileData ?? null, updatedAt: row?.updatedAt ?? null });
});

export const PUT = handler(async (req: Request) => {
  const user = await requireUser();
  const profile = ProfileSchema.parse(await req.json());
  profile.skills = dedupeSkills(profile.skills);
  for (const e of profile.experience) e.bullets = e.bullets.map((b) => b.trim()).filter(Boolean);
  await db
    .insert(schema.profiles)
    .values({ userId: user.id, profileData: profile })
    .onConflictDoUpdate({
      target: schema.profiles.userId,
      set: { profileData: profile, updatedAt: new Date() },
    });
  return json({ profile });
});
