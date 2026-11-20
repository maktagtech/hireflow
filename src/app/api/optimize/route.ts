import { z } from "zod";
import { handler, json } from "@/lib/api";
import { requireUser } from "@/lib/auth";
import { optimize } from "@/lib/pipeline";
import { rateLimit } from "@/lib/rate-limit";

const Body = z
  .object({
    url: z.string().trim().max(2000).optional(),
    text: z.string().max(60_000).optional(),
  })
  .refine((b) => b.url || b.text, "Paste a job URL or a job description");

/** One click: job in → tailored resume, cover letter, ATS score out. */
export const POST = handler(async (req: Request) => {
  const user = await requireUser();
  rateLimit(`optimize:${user.id}`, 30, 60 * 60_000);
  const body = Body.parse(await req.json());
  return json(await optimize(user.id, body), 201);
});
