import "server-only";
import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from "pdf-lib";
import type { Block } from "./blocks";

const PAGE_W = 612; // US Letter, points
const PAGE_H = 792;
const MARGIN_X = 50;
const MARGIN_Y = 46;
const CONTENT_W = PAGE_W - MARGIN_X * 2;
const INK = rgb(0.07, 0.07, 0.07);

/**
 * Standard PDF fonts only support WinAnsi. Map common Unicode punctuation to
 * supported glyphs and drop anything else rather than failing the export.
 */
const WIN_ANSI_EXTRA = new Set("€‚ƒ„…†‡ˆ‰Š‹ŒŽ‘’“”•–—˜™š›œžŸ");
const REPLACEMENTS: Record<string, string> = { "→": "->", "←": "<-", "≥": ">=", "≤": "<=", "✓": "-", "●": "•", "▪": "•", "◦": "•", "‑": "-", "−": "-", " ": " ", "\t": " " };
function sanitize(s: string): string {
  let out = "";
  for (const ch of s) {
    const code = ch.codePointAt(0)!;
    if ((code >= 0x20 && code <= 0x7e) || (code >= 0xa0 && code <= 0xff) || WIN_ANSI_EXTRA.has(ch)) out += ch;
    else if (REPLACEMENTS[ch]) out += REPLACEMENTS[ch];
  }
  return out;
}

class Writer {
  page!: PDFPage;
  y = 0;
  constructor(
    private doc: PDFDocument,
    readonly regular: PDFFont,
    readonly bold: PDFFont,
    readonly italic: PDFFont,
  ) {
    this.newPage();
  }

  newPage() {
    this.page = this.doc.addPage([PAGE_W, PAGE_H]);
    this.y = PAGE_H - MARGIN_Y;
  }

  ensure(height: number) {
    if (this.y - height < MARGIN_Y) this.newPage();
  }

  wrap(text: string, font: PDFFont, size: number, width: number): string[] {
    const words = sanitize(text).split(/\s+/).filter(Boolean);
    const lines: string[] = [];
    let line = "";
    for (const word of words) {
      const candidate = line ? `${line} ${word}` : word;
      if (font.widthOfTextAtSize(candidate, size) <= width) line = candidate;
      else {
        if (line) lines.push(line);
        // Hard-break words longer than the line (e.g. long URLs).
        let rest = word;
        while (font.widthOfTextAtSize(rest, size) > width) {
          let i = rest.length;
          while (i > 1 && font.widthOfTextAtSize(rest.slice(0, i), size) > width) i--;
          lines.push(rest.slice(0, i));
          rest = rest.slice(i);
        }
        line = rest;
      }
    }
    if (line) lines.push(line);
    return lines;
  }

  text(
    text: string,
    opts: { font?: PDFFont; size?: number; x?: number; width?: number; align?: "left" | "center"; leading?: number; after?: number },
  ) {
    const font = opts.font ?? this.regular;
    const size = opts.size ?? 10;
    const x = opts.x ?? MARGIN_X;
    const width = opts.width ?? CONTENT_W - (x - MARGIN_X);
    const leading = opts.leading ?? size * 1.32;
    for (const line of this.wrap(text, font, size, width)) {
      this.ensure(leading);
      const lx = opts.align === "center" ? MARGIN_X + (CONTENT_W - font.widthOfTextAtSize(line, size)) / 2 : x;
      this.page.drawText(line, { x: lx, y: this.y - size, size, font, color: INK });
      this.y -= leading;
    }
    this.y -= opts.after ?? 0;
  }
}

export async function renderPdf(blocks: Block[], opts: { title: string; centerHeader?: boolean }): Promise<Buffer> {
  const doc = await PDFDocument.create();
  doc.setTitle(sanitize(opts.title));
  doc.setCreator("HireFlow");
  doc.setProducer("HireFlow");
  const w = new Writer(
    doc,
    await doc.embedFont(StandardFonts.Helvetica),
    await doc.embedFont(StandardFonts.HelveticaBold),
    await doc.embedFont(StandardFonts.HelveticaOblique),
  );
  const align = opts.centerHeader === false ? "left" : "center";

  for (let i = 0; i < blocks.length; i++) {
    const b = blocks[i];
    switch (b.type) {
      case "name":
        w.text(b.text, { font: w.bold, size: 18, align, after: 2 });
        break;
      case "contact":
        w.text(b.text, { size: 9.5, align, after: 2 });
        break;
      case "headline":
        w.text(b.text, { font: w.italic, size: 10.5, align: "center", after: 2 });
        break;
      case "heading": {
        // Keep a heading with at least the first lines of its section.
        w.ensure(48);
        w.y -= 8;
        w.text(b.text.toUpperCase(), { font: w.bold, size: 11, after: 1 });
        w.page.drawLine({
          start: { x: MARGIN_X, y: w.y + 2 },
          end: { x: PAGE_W - MARGIN_X, y: w.y + 2 },
          thickness: 0.6,
          color: rgb(0.3, 0.3, 0.3),
        });
        w.y -= 5;
        break;
      }
      case "paragraph":
        w.text(b.text, { size: 10, after: 3 });
        break;
      case "entry": {
        w.ensure(b.sub ? 44 : 30);
        const right = sanitize(b.right);
        const rightW = right ? w.regular.widthOfTextAtSize(right, 10) : 0;
        const startY = w.y;
        w.text(b.left, { font: w.bold, size: 10.5, width: CONTENT_W - rightW - 12 });
        if (right) w.page.drawText(right, { x: PAGE_W - MARGIN_X - rightW, y: startY - 10.5, size: 10, font: w.regular, color: INK });
        if (b.sub) w.text(b.sub, { font: w.italic, size: 9.5 });
        w.y -= 1;
        break;
      }
      case "bullet": {
        const lines = w.wrap(b.text, w.regular, 10, CONTENT_W - 14);
        w.ensure(13.2);
        w.page.drawText("•", { x: MARGIN_X + 3, y: w.y - 10, size: 10, font: w.regular, color: INK });
        w.text(lines.join(" "), { x: MARGIN_X + 14, size: 10, after: 1.5 });
        break;
      }
      case "spacer":
        w.y -= 6;
        break;
    }
  }
  return Buffer.from(await doc.save());
}
