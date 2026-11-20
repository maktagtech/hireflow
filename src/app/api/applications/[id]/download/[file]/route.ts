import { NextResponse } from "next/server";
import { HttpError, handler } from "@/lib/api";
import { getApplication } from "@/lib/applications";
import { requireUser } from "@/lib/auth";
import { getStorage } from "@/lib/storage";

const FILES = {
  "resume.pdf": { column: "pdfUrl", type: "application/pdf" },
  "resume.docx": { column: "docxUrl", type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document" },
  "cover-letter.pdf": { column: "coverLetterPdfUrl", type: "application/pdf" },
  "cover-letter.docx": { column: "coverLetterDocxUrl", type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document" },
} as const;

function downloadName(name: string, title: string, file: string) {
  const slug = (s: string) => s.replace(/[^\w]+/g, "_").replace(/^_|_$/g, "");
  const [base, ext] = file.split(".");
  const prefix = base === "resume" ? "Resume" : "CoverLetter";
  return `${[slug(name), prefix, slug(title)].filter(Boolean).join("_")}.${ext}`;
}

export const GET = handler(async (_req: Request, ctx: RouteContext<"/api/applications/[id]/download/[file]">) => {
  const user = await requireUser();
  const { id, file } = await ctx.params;
  const spec = FILES[file as keyof typeof FILES];
  if (!spec) throw new HttpError(404, "File not found");
  const { job, generated } = await getApplication(user.id, id);
  if (!generated) throw new HttpError(404, "File not found");

  const key = generated[spec.column];
  const filename = downloadName(generated.tailoredProfile.name, job.jobTitle, file);
  const storage = getStorage();
  const signed = await storage.signedUrl(key, filename);
  if (signed) return NextResponse.redirect(signed, 302);

  const body = await storage.get(key);
  return new Response(new Uint8Array(body), {
    headers: {
      "content-type": spec.type,
      "content-disposition": `attachment; filename="${filename}"`,
      "cache-control": "private, no-store",
    },
  });
});
