# HireFlow

Upload a master resume once, paste a job URL (or description), click **Optimize**, and get:

- a tailored, ATS-friendly **resume** (PDF + DOCX)
- a matching **cover letter** (PDF + DOCX)
- an **ATS match score** (skills / experience / keywords), before vs. after tailoring
- a **gap analysis**: the skills and keywords the job wants that the profile lacks

Each application's outcome is tracked (applied → interview → offer), and the dashboard leads with **interview rate**.

## Quick start

Requirements: Node 22+ and a Postgres database: a free [Neon](https://neon.tech) database (recommended) or a local
Postgres.

```bash
npm install
cp .env.example .env.local          # set DATABASE_URL (Neon connection string) and SESSION_SECRET
npm run db:migrate                  # creates the tables
npm run dev                         # http://localhost:3000
```

Already deployed to Vercel? Use `vercel env pull .env.local` instead of copying `.env.example`.

**Deploying:** see [DEPLOY.md](DEPLOY.md) for Vercel + Neon + Vercel Blob. Migrations run automatically on every
Vercel build (`vercel.json`).

The app runs end to end **without any AI key**, using a deterministic offline engine. To use an LLM, set one of
`ANTHROPIC_API_KEY`, `OPENAI_API_KEY` or `GEMINI_API_KEY`. You can force a provider with `AI_PROVIDER` and a model
with `AI_MODEL`.

| Script | What it does |
| --- | --- |
| `npm run dev` / `build` / `start` | Next.js |
| `npm test` | Engine, parser, truth-guard and renderer tests (Vitest) |
| `npm run typecheck` | Route type generation + `tsc` |
| `npm run db:generate` | Create a new migration in `drizzle/` after editing `src/db/schema.ts` |
| `npm run db:migrate` | Apply migrations to `DATABASE_URL` (Neon or local Postgres) |
| `npm run db:studio` | Browse the database (Drizzle Studio) |

## Private beta

Set `BETA_INVITE_ONLY=true` (the default in `.env.example`) so that signing up requires an invite code.

```bash
npm run invite -- create --email ada@example.com --name "Ada Lovelace"   # locked to that email; sends the invite
npm run invite -- create --uses 25 --days 14 --note "LinkedIn post"     # shareable code, expires in 14 days
npm run invite -- create --email ada@example.com --no-email             # just print the link
npm run invite -- list                                                   # usage of every invite
```

Invite links (`/signup?invite=…&email=…`) pre-fill the signup form. Links use `APP_URL`, so set it to the address
your users will open.

## Email

Password-reset and invite emails go through [Resend](https://resend.com) when `RESEND_API_KEY` is set. Use an
`EMAIL_FROM` address on a domain you've verified there. Without a key, development prints emails to the server log;
production logs an error and drops the email.

## Accounts and privacy

- **Password reset:** single-use links that expire after 1 hour. Only a hash of the token is stored, and the
  response is identical whether or not the email exists.
- **Sessions:** changing or resetting a password bumps `users.session_version`, which signs out every other session.
- **Settings page:** change password, download all data (JSON), and delete account. Deletion removes stored files
  first, then the database rows (cascading).
- **Legal pages:** `/privacy` and `/terms` describe what this codebase actually does, and signup records
  `accepted_terms_at`. Set `NEXT_PUBLIC_OPERATOR_NAME` and `NEXT_PUBLIC_CONTACT_EMAIL`, and have both documents
  reviewed for your jurisdiction before a public launch (Terms has no governing-law clause yet).

## Architecture

One Next.js 16 app (TypeScript, Tailwind). The backend is REST route handlers under `src/app/api`, and all domain
logic lives in `src/lib`, independent of the web framework.

```
src/lib/
  types.ts            Zod contracts: Profile, Job, Tailoring, CoverLetter, AtsScore
  ai/                 Provider abstraction: anthropic.ts, openai.ts, gemini.ts behind one interface
  parse/              Resume text extraction (PDF/DOCX), heuristic + AI structuring,
                      job URL scraping (JSON-LD JobPosting first) with SSRF protection
  match/
    skills.ts         Skill vocabulary: synonyms ("k8s" = Kubernetes) vs. evidence ("Scrum" implies Agile)
    score.ts          Deterministic ATS score
    tailor.ts         AI or offline tailoring, then truth-guard validation + relevance ordering
    truth.ts          Rejects generated text that cites skills or figures not in the profile
    cover-letter.ts
  render/             Shared block model -> DOCX (docx) and PDF (pdf-lib); single-column ATS layout
  pipeline.ts         The one-click flow: import -> score -> tailor + letter -> render -> store
  storage.ts          Vercel Blob (private), S3, or local disk in development
```

### Key design decisions

- **Truthful by construction.** The LLM is never trusted to stay honest. It may only return a headline, a summary and
  bullet rewrites keyed to existing bullets. `TruthGuard` rejects any rewrite that introduces a skill or a number not
  already in the profile, and the original bullet is kept. Missing skills are shown as gaps, never added.
- **The score is deterministic.** The ATS score is computed in code, not by the model, so the same resume and job
  always give the same number, and "before vs. after" is a fair comparison. "X or Y" requirements count as
  alternatives.
- **No hardcoded model.** Every LLM call goes through `generateStructured(schema)` and is validated with Zod. If the
  provider fails, the pipeline falls back to the offline engine, so the user still gets a full package.
- **One document model, two formats.** PDF and DOCX render from the same blocks, so they always match. Section
  headings use a real Heading style, with no tables, columns or images.

### Data model

`users`, `profiles` (one JSONB master profile per user), `jobs` (description, parsed job, status for interview-rate
tracking), and `generated_resumes` (version, storage keys for the 4 files, scores, tailoring, cover letter). The
`*_url` columns store storage keys. Downloads go through `/api/applications/:id/download/:file`, which checks ownership,
then either streams the file (Vercel Blob, local disk) or redirects to a 5-minute presigned S3 URL.

## Production notes

- Rate limiting (`src/lib/rate-limit.ts`) is in-memory per instance. Move it to Redis before scaling out.
- `optimize` runs synchronously (~0.1 s offline; one LLM round trip per document with AI). At higher volume, move it to
  a job queue and poll.
- The URL fetcher blocks private and link-local addresses and re-checks every redirect. DNS is resolved separately from
  the fetch, so DNS-rebinding protection would need a pinned-IP agent.
- Some job boards (e.g. LinkedIn) block scrapers. The UI then switches the user to "Paste description".
