import "server-only";
import { Pool as NeonPool } from "@neondatabase/serverless";
import { drizzle as drizzleNeon } from "drizzle-orm/neon-serverless";
import { drizzle as drizzlePg, type NodePgDatabase } from "drizzle-orm/node-postgres";
import { Pool as PgPool } from "pg";
import { databaseUrl, isNeonUrl } from "./url";
import * as schema from "./schema";

/**
 * Database access.
 *
 * - Neon (Vercel): Neon's serverless driver over WebSockets. It supports the
 *   transactions used by signup and password reset, and suits short-lived functions.
 * - Any other Postgres (e.g. a local `createdb hireflow`): node-postgres over TCP.
 *
 * Both expose the same Drizzle API, so the rest of the app doesn't care which is used.
 */
type Db = NodePgDatabase<typeof schema>;

function connect(): Db {
  const url = databaseUrl();
  if (isNeonUrl(url)) {
    // Same query API as node-postgres; only the driver's result type differs.
    return drizzleNeon({ client: new NeonPool({ connectionString: url, max: 5 }), schema }) as unknown as Db;
  }
  return drizzlePg({ client: new PgPool({ connectionString: url, max: 10 }), schema });
}

// Reuse one pool across hot reloads (dev) and warm function invocations (Vercel).
const g = globalThis as unknown as { __hireflowDb?: Db };
export const db: Db = (g.__hireflowDb ??= connect());
export { schema };
