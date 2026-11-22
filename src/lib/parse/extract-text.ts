import "server-only";
import { htmlToText } from "./html";

// Vercel rejects request bodies over 4.5 MB, so keep uploads under that.
export const MAX_UPLOAD_BYTES = 4 * 1024 * 1024;

export type UploadKind = "pdf" | "docx" | "txt";

export function detectKind(filename: string, mime: string, bytes: Uint8Array): UploadKind | null {
  // Trust magic bytes over the client-supplied name/type.
  if (bytes[0] === 0x25 && bytes[1] === 0x50 && bytes[2] === 0x44 && bytes[3] === 0x46) return "pdf"; // %PDF
  if (bytes[0] === 0x50 && bytes[1] === 0x4b && /\.docx$/i.test(filename)) return "docx"; // ZIP
  if (bytes[0] === 0x50 && bytes[1] === 0x4b && mime.includes("wordprocessingml")) return "docx";
  if (/\.(txt|md)$/i.test(filename) || mime.startsWith("text/")) return "txt";
  return null;
}

export async function extractText(kind: UploadKind, bytes: Uint8Array): Promise<string> {
  switch (kind) {
    case "pdf": {
      const { extractText: pdfText, getDocumentProxy } = await import("unpdf");
      const pdf = await getDocumentProxy(new Uint8Array(bytes));
      const { text } = await pdfText(pdf, { mergePages: false });
      return (Array.isArray(text) ? text.join("\n") : text).replace(/\u0000/g, "");
    }
    case "docx": {
      // HTML conversion keeps list structure (raw text drops Word's bullet glyphs).
      const mammoth = await import("mammoth");
      const { value } = await mammoth.convertToHtml({ buffer: Buffer.from(bytes) });
      return htmlToText(value);
    }
    case "txt":
      return new TextDecoder().decode(bytes);
  }
}
