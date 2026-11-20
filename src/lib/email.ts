import "server-only";
import { site } from "./config";

export type Email = { to: string; subject: string; text: string; html?: string };

/**
 * Transactional email. Uses Resend when RESEND_API_KEY is set; otherwise the
 * message is printed to the server log so flows can be tested locally.
 */
export async function sendEmail(email: Email): Promise<void> {
  const key = process.env.RESEND_API_KEY;
  if (!key) {
    if (process.env.NODE_ENV === "production") {
      console.error(`[email] RESEND_API_KEY is not set; dropped "${email.subject}" to ${email.to}`);
      return;
    }
    console.log(`\n[email] (dev, not sent) To: ${email.to}\nSubject: ${email.subject}\n\n${email.text}\n`);
    return;
  }
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { authorization: `Bearer ${key}`, "content-type": "application/json" },
    body: JSON.stringify({
      from: process.env.EMAIL_FROM || `${site.name} <onboarding@resend.dev>`,
      to: [email.to],
      subject: email.subject,
      text: email.text,
      html: email.html ?? textToHtml(email.text),
    }),
    signal: AbortSignal.timeout(10_000),
  });
  if (!res.ok) throw new Error(`Email provider error ${res.status}: ${await res.text()}`);
}

function escapeHtml(s: string) {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
}

/** Minimal HTML version: paragraphs, with bare URLs turned into links. */
function textToHtml(text: string) {
  const body = text
    .split(/\n{2,}/)
    .map((p) =>
      `<p>${escapeHtml(p)
        .replace(/(https?:\/\/[^\s<]+)/g, '<a href="$1">$1</a>')
        .replace(/\n/g, "<br>")}</p>`,
    )
    .join("");
  return `<div style="font-family:-apple-system,Segoe UI,Arial,sans-serif;font-size:15px;line-height:1.5;color:#0f172a;max-width:560px">${body}</div>`;
}

/**
 * Absolute base URL for links in emails. Never derived from the request's
 * Host header in production (that would allow reset-link poisoning).
 */
export function appUrl(req?: Request): string {
  const configured = process.env.APP_URL?.replace(/\/$/, "");
  if (configured) return configured;
  if (process.env.NODE_ENV === "production") throw new Error("APP_URL must be set in production");
  return req ? new URL(req.url).origin : "http://localhost:3000";
}
