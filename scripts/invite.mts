/**
 * Beta invite admin CLI.
 *
 *   npm run invite -- create --email ada@example.com [--note "from meetup"] [--days 14]
 *   npm run invite -- create --uses 20 --note "LinkedIn post"     (shareable multi-use code, no email)
 *   npm run invite -- list
 *
 * With --email, the invite is locked to that address and an invitation email
 * is sent (printed to the console if RESEND_API_KEY isn't set). Pass --no-email
 * to just print the link.
 */
import { parseArgs } from "node:util";
import { desc } from "drizzle-orm";
import { db, schema } from "../src/db";
import { site } from "../src/lib/config";
import { appUrl, sendEmail } from "../src/lib/email";
import { createInvite } from "../src/lib/invites";

const { positionals, values } = parseArgs({
  allowPositionals: true,
  options: {
    email: { type: "string" },
    name: { type: "string" },
    note: { type: "string", default: "" },
    uses: { type: "string", default: "1" },
    days: { type: "string" },
    "no-email": { type: "boolean", default: false },
  },
});

async function create() {
  const email = values.email?.toLowerCase().trim();
  if (email && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) throw new Error(`Invalid email: ${email}`);
  const invite = await createInvite({
    email,
    maxUses: Number(values.uses),
    note: values.note,
    expiresInDays: values.days ? Number(values.days) : undefined,
  });
  const params = new URLSearchParams({ invite: invite.code, ...(email ? { email } : {}) });
  const link = `${appUrl()}/signup?${params}`;

  console.log(`\nInvite ${invite.code}  (${invite.maxUses} use${invite.maxUses === 1 ? "" : "s"}${email ? `, for ${email}` : ""}${invite.expiresAt ? `, expires ${invite.expiresAt.toDateString()}` : ""})`);
  console.log(`Signup link: ${link}\n`);

  if (email && !values["no-email"]) {
    const first = values.name?.split(" ")[0];
    await sendEmail({
      to: email,
      subject: `You're invited to the ${site.name} beta`,
      text: `Hi${first ? ` ${first}` : ""},\n\nYou're invited to try ${site.name} — upload your resume once, paste any job link, and get a tailored, ATS-optimized resume and cover letter in about 30 seconds.\n\nCreate your account here:\n${link}\n\nYour invite code is ${invite.code}.\n\nIt's an early beta, so we'd love your honest feedback — just reply to this email.`,
    });
    console.log(`Invitation email sent to ${email}.`);
  }
}

async function list() {
  const rows = await db.select().from(schema.invites).orderBy(desc(schema.invites.createdAt));
  if (!rows.length) return console.log("No invites yet.");
  console.table(
    rows.map((r) => ({
      code: r.code,
      email: r.email ?? "(any)",
      used: `${r.uses}/${r.maxUses}`,
      expires: r.expiresAt ? r.expiresAt.toISOString().slice(0, 10) : "never",
      note: r.note,
      created: r.createdAt.toISOString().slice(0, 10),
    })),
  );
}

const command = positionals[0];
try {
  if (command === "create") await create();
  else if (command === "list") await list();
  else {
    console.log("Usage: npm run invite -- create --email <address> [--name <name>] [--note <text>] [--days <n>] [--uses <n>] [--no-email]");
    console.log("       npm run invite -- list");
    process.exitCode = 1;
  }
} finally {
  process.exit();
}
