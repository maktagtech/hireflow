// Applies the SQL migrations in ./drizzle to the database. Safe to run repeatedly:
// already-applied migrations are skipped.
//
//   npm run db:migrate            (uses DATABASE_URL from .env.local)
//
// Vercel runs this before every build (see vercel.json), so a new deployment always
// has an up-to-date schema. With no database connected yet it skips with a warning.
import { fileURLToPath } from "node:url";

try {
  process.loadEnvFile(".env.local"); // local only; never overrides variables already set
} catch {}

const url = process.env.DATABASE_URL || process.env.POSTGRES_URL;
if (!url) {
  if (process.env.VERCEL) {
    console.warn("[migrate] DATABASE_URL is not set: skipping. Connect a Neon database in Vercel > Storage, then redeploy.");
    process.exit(0);
  }
  console.error("[migrate] Set DATABASE_URL in .env.local (your Neon connection string) first.");
  process.exit(1);
}

const migrationsFolder = fileURLToPath(new URL("../drizzle", import.meta.url));
const host = new URL(url).hostname;

if (host.endsWith(".neon.tech")) {
  const { Pool } = await import("@neondatabase/serverless");
  const { drizzle } = await import("drizzle-orm/neon-serverless");
  const { migrate } = await import("drizzle-orm/neon-serverless/migrator");
  const pool = new Pool({ connectionString: url });
  await migrate(drizzle({ client: pool }), { migrationsFolder });
  await pool.end();
} else {
  const { default: pg } = await import("pg");
  const { drizzle } = await import("drizzle-orm/node-postgres");
  const { migrate } = await import("drizzle-orm/node-postgres/migrator");
  const pool = new pg.Pool({ connectionString: url });
  await migrate(drizzle({ client: pool }), { migrationsFolder });
  await pool.end();
}
console.log(`[migrate] Database is up to date (${host}).`);
