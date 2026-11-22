import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { db, schema } from "@/db";
import { HttpError, handler, json } from "@/lib/api";
import { requireUser } from "@/lib/auth";
import { detectKind, extractText, MAX_UPLOAD_BYTES } from "@/lib/parse/extract-text";
import { structureResume } from "@/lib/parse/resume";
import { rateLimit } from "@/lib/rate-limit";
import { getStorage } from "@/lib/storage";

const MIME = { pdf: "application/pdf", docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document", txt: "text/plain" };

// AI calls can take a while; allow up to 2 minutes on Vercel.
export const maxDuration = 120;

/** Upload a master resume (PDF, DOCX or LinkedIn PDF export) and parse it into the profile. */
export const POST = handler(async (req: Request) => {
  const user = await requireUser();
  rateLimit(`upload:${user.id}`, 20, 60 * 60_000);

  const form = await req.formData();
  const file = form.get("file");
  if (!(file instanceof File)) throw new HttpError(400, "Choose a resume file to upload");
  if (file.size > MAX_UPLOAD_BYTES) throw new HttpError(413, "File is too large (4 MB max)");

  const bytes = new Uint8Array(await file.arrayBuffer());
  const kind = detectKind(file.name, file.type, bytes);
  if (!kind) throw new HttpError(415, "Upload a PDF or DOCX resume");

  const text = (await extractText(kind, bytes)).trim();
  if (text.length < 100) {
    throw new HttpError(422, "We couldn't read text from that file. If it's a scanned image, upload a DOCX or text-based PDF instead.");
  }

  const { profile, via } = await structureResume(text);
  const key = `users/${user.id}/uploads/${randomUUID()}.${kind}`;
  await getStorage().put(key, bytes, MIME[kind]);

  const [previous] = await db
    .select({ key: schema.profiles.sourceFileKey })
    .from(schema.profiles)
    .where(eq(schema.profiles.userId, user.id));
  await db
    .insert(schema.profiles)
    .values({ userId: user.id, profileData: profile, sourceFileKey: key })
    .onConflictDoUpdate({
      target: schema.profiles.userId,
      set: { profileData: profile, sourceFileKey: key, updatedAt: new Date() },
    });
  // Don't keep superseded resume files around.
  if (previous?.key && previous.key !== key) await getStorage().delete(previous.key).catch(() => {});
  return json({ profile, parsedBy: via });
});
