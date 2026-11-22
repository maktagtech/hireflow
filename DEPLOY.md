# Deploy HireFlow to Vercel + Neon

Time needed: about 15 minutes. You need the GitHub repository (`Whizzkid-FG/HireFlow`) and a Vercel account signed in with GitHub.

What runs where:

| Piece | Service | Set up in |
|---|---|---|
| App (pages + API) | Vercel | Step 1 |
| Database | Neon Postgres | Step 2 (Vercel → Storage) |
| Uploaded resumes + generated PDF/DOCX | Vercel Blob, **private** | Step 3 (Vercel → Storage) |
| Emails (invites, password reset) | Resend, optional | Step 5 |

## 1. Create the Vercel project

1. vercel.com → **Add New → Project** → import `HireFlow`.
2. Framework preset: **Next.js** (detected). Leave the build settings alone: `vercel.json` already runs the database migrations before each build.
3. Open **Environment Variables** and add:
   | Name | Value |
   |---|---|
   | `SESSION_SECRET` | 48+ random characters. Generate with `node -e "console.log(require('crypto').randomBytes(48).toString('base64'))"` |
   | `BETA_INVITE_ONLY` | `true` (sign-up needs an invite code) or `false` |
   | `NEXT_PUBLIC_OPERATOR_NAME` | the legal entity shown in Privacy/Terms, e.g. `MAKTAG Technology Services LLC` |
   | `NEXT_PUBLIC_CONTACT_EMAIL` | the support/privacy contact address |
   | `ANTHROPIC_API_KEY` | optional: AI tailoring (or `OPENAI_API_KEY` / `GEMINI_API_KEY`). Without one the offline engine is used. |
4. Click **Deploy**. This first build prints `DATABASE_URL is not set: skipping`. That's expected: the app has no database yet.

## 2. Connect the Neon database

1. In the Vercel project: **Storage → Create Database → Neon (Serverless Postgres)** → free plan. Pick the region that matches your Vercel functions (default is Washington, D.C., so choose **AWS US East 1**) → **Connect** to this project for all environments.
2. Vercel adds `DATABASE_URL` automatically. Check it under **Settings → Environment Variables**.

Already have a Neon account? Create a project at console.neon.tech, copy the **pooled** connection string (host contains `-pooler`), and add it in Vercel as `DATABASE_URL` yourself.

## 3. Connect file storage (Vercel Blob)

Vercel's own disk is wiped between requests, so uploaded resumes and generated documents need Blob storage.

1. **Storage → Create → Blob** → choose **Private** access (resumes are personal data) → **Connect** to this project for all environments.
2. Vercel adds `BLOB_READ_WRITE_TOKEN` automatically.

Files are stored privately. Downloads go through `/api/applications/:id/download/:file`, which checks that the file belongs to the signed-in user.

## 4. Redeploy and check it works

1. **Deployments → … → Redeploy**. The build log now shows `[migrate] Database is up to date (…neon.tech)`. The tables are created at this point, and later schema changes are applied the same way on every deploy.
2. Open the site and create an account. With `BETA_INVITE_ONLY=true`, create an invite first (see below).
3. On **Profile**, upload a resume (PDF or DOCX, up to 4 MB). Then paste a job description and click **Optimize**.
4. Download the tailored resume PDF from the application page.

If something fails, open the deployment → **Logs**. The messages are explicit:
- `No file storage configured` → step 3 is missing, or you didn't redeploy after it.
- `SESSION_SECRET must be set` → add it in step 1, then redeploy.
- Connection errors → check `DATABASE_URL` from step 2.

## 5. Optional

- **Invites for the beta:** run the invite CLI from your computer against the production database. Pull the variables first (step "Run locally" below), then `npm run invite -- create --email someone@example.com`. Links use `APP_URL`. On Vercel it defaults to the production domain, so set `APP_URL` in `.env.local` to `https://your-project.vercel.app` before creating invites locally.
- **Email (Resend):** create a resend.com account, verify your domain, then set `RESEND_API_KEY` and `EMAIL_FROM` (e.g. `HireFlow <hello@yourdomain.com>`). Without it, invites and password-reset emails are **not sent** in production, only logged.
- **Custom domain:** add it under **Settings → Domains**, then set `APP_URL=https://yourdomain.com` so email links use it. Redeploy.
- **Preview deployments:** the Neon integration can give each preview its own database branch, so testing never touches production data. Turn this on in the Neon integration's settings.

## Run locally against Neon

```bash
npm i -g vercel           # once
vercel link               # once: pick this project
vercel env pull .env.local
npm run dev               # http://localhost:3000
```

This uses the **same** database as production. To keep test data separate, create a `dev` branch in the Neon console and put its connection string in `.env.local` as `DATABASE_URL`, then run `npm run db:migrate` once.

Locally, files are saved to `.storage/` unless `BLOB_READ_WRITE_TOKEN` is in `.env.local` (`vercel env pull` adds it). Delete that line to keep local test files off Vercel Blob.

## Limits to know

- **Uploads:** Vercel caps request bodies at 4.5 MB, so resume uploads are limited to 4 MB.
- **Time:** Optimize and upload may run up to 120 seconds (`maxDuration`). This works on the Hobby plan with Fluid compute, which is on by default for new projects.
- **Rate limiting** is held in each server instance's memory. It is enough for a beta. For a public launch, move it to a shared store such as Upstash Redis (Vercel → Storage).

## Costs

- **Vercel:** Hobby is free but for non-commercial use only. A paid product belongs on Pro ($20/month per seat).
- **Neon:** the free plan covers a beta.
- **Vercel Blob:** free allowance on Hobby, then pay as you go. Resumes are small.
- **Resend:** the free plan covers invites and password resets.
- **AI provider:** pay as you go, one model call per document generated.
