import "server-only";
import {
  AlignmentType,
  BorderStyle,
  Document,
  LevelFormat,
  Packer,
  Paragraph,
  TabStopType,
  TextRun,
} from "docx";
import type { Block } from "./blocks";

const FONT = "Calibri";
const PAGE_WIDTH_TWIPS = 12240; // US Letter
const MARGIN = 1008; // 0.7"
const CONTENT_RIGHT = PAGE_WIDTH_TWIPS - MARGIN * 2;

function toParagraph(b: Block, centerHeader: boolean): Paragraph {
  switch (b.type) {
    case "name":
      return new Paragraph({
        alignment: centerHeader ? AlignmentType.CENTER : AlignmentType.LEFT,
        spacing: { after: 40 },
        children: [new TextRun({ text: b.text, bold: true, size: 36, font: FONT })],
      });
    case "contact":
      return new Paragraph({
        alignment: centerHeader ? AlignmentType.CENTER : AlignmentType.LEFT,
        spacing: { after: 40 },
        children: [new TextRun({ text: b.text, size: 19, font: FONT })],
      });
    case "headline":
      return new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { after: 80 },
        children: [new TextRun({ text: b.text, size: 22, font: FONT, italics: true })],
      });
    case "heading":
      // A real Heading style lets ATS parsers detect section boundaries.
      return new Paragraph({
        style: "Heading1",
        spacing: { before: 200, after: 80 },
        border: { bottom: { style: BorderStyle.SINGLE, size: 6, color: "444444", space: 2 } },
        children: [new TextRun({ text: b.text.toUpperCase(), bold: true, size: 22, font: FONT, color: "111111" })],
      });
    case "paragraph":
      return new Paragraph({
        spacing: { after: 60 },
        children: [new TextRun({ text: b.text, size: 20, font: FONT })],
      });
    case "entry":
      return new Paragraph({
        spacing: { before: 40, after: b.sub ? 0 : 40 },
        tabStops: [{ type: TabStopType.RIGHT, position: CONTENT_RIGHT }],
        children: [
          new TextRun({ text: b.left, bold: true, size: 21, font: FONT }),
          ...(b.right ? [new TextRun({ text: `\t${b.right}`, size: 20, font: FONT })] : []),
          ...(b.sub ? [new TextRun({ text: b.sub, break: 1, italics: true, size: 19, font: FONT })] : []),
        ],
      });
    case "bullet":
      return new Paragraph({
        numbering: { reference: "bullets", level: 0 },
        spacing: { after: 30 },
        children: [new TextRun({ text: b.text, size: 20, font: FONT })],
      });
    case "spacer":
      return new Paragraph({ spacing: { after: 60 }, children: [] });
  }
}

export async function renderDocx(blocks: Block[], opts: { title: string; centerHeader?: boolean }): Promise<Buffer> {
  const doc = new Document({
    title: opts.title,
    creator: "HireFlow",
    styles: {
      default: { document: { run: { font: FONT, size: 20 } } },
      paragraphStyles: [
        { id: "Heading1", name: "Heading 1", basedOn: "Normal", next: "Normal", quickFormat: true, run: { font: FONT } },
      ],
    },
    numbering: {
      config: [
        {
          reference: "bullets",
          levels: [
            {
              level: 0,
              format: LevelFormat.BULLET,
              text: "•",
              alignment: AlignmentType.LEFT,
              style: { paragraph: { indent: { left: 360, hanging: 260 } } },
            },
          ],
        },
      ],
    },
    sections: [
      {
        properties: { page: { size: { width: PAGE_WIDTH_TWIPS, height: 15840 }, margin: { top: 864, bottom: 864, left: MARGIN, right: MARGIN } } },
        children: blocks.map((b) => toParagraph(b, opts.centerHeader ?? true)),
      },
    ],
  });
  return Packer.toBuffer(doc);
}
