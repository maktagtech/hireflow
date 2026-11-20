import * as cheerio from "cheerio";

/** Convert HTML to text, keeping list items ("• ") and block elements on their own lines. */
export function htmlToText(html: string): string {
  const $ = cheerio.load(html);
  $("br").replaceWith("\n");
  $("li").each((_, el) => {
    $(el).prepend("• ");
    $(el).append("\n");
  });
  $("p, div, h1, h2, h3, h4, h5, h6, ul, ol, section, tr").each((_, el) => {
    $(el).append("\n");
  });
  return $.root()
    .text()
    .replace(/ /g, " ")
    .split("\n")
    .map((l) => l.replace(/[ \t]+/g, " ").trim())
    .filter(Boolean)
    .join("\n");
}
