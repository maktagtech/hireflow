import "server-only";
import { cookies } from "next/headers";
import { eq } from "drizzle-orm";
import { db, schema } from "@/db";
import { SESSION_COOKIE, SESSION_TTL_SECONDS, signSession, verifySession } from "./session";

export type SessionUser = { id: string; email: string; name: string };

export class UnauthorizedError extends Error {
  constructor() {
    super("Not signed in");
  }
}

export async function startSession(userId: string, sessionVersion: number) {
  (await cookies()).set(SESSION_COOKIE, await signSession(userId, sessionVersion), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_TTL_SECONDS,
  });
}

export async function endSession() {
  (await cookies()).delete(SESSION_COOKIE);
}

/**
 * Resolve the signed-in user from the session cookie, verified against the DB.
 * A session minted before the last password change (older version) is rejected.
 */
export async function getUser(): Promise<SessionUser | null> {
  const claims = await verifySession((await cookies()).get(SESSION_COOKIE)?.value);
  if (!claims) return null;
  const [user] = await db
    .select({
      id: schema.users.id,
      email: schema.users.email,
      name: schema.users.name,
      sessionVersion: schema.users.sessionVersion,
    })
    .from(schema.users)
    .where(eq(schema.users.id, claims.userId))
    .limit(1);
  if (!user || user.sessionVersion !== claims.version) {
    // Stale (password changed) or orphaned (account deleted) session: clear it so
    // the proxy stops treating this browser as signed in. Only allowed where
    // cookies are writable (route handlers / actions).
    try {
      (await cookies()).delete(SESSION_COOKIE);
    } catch {}
    return null;
  }
  return { id: user.id, email: user.email, name: user.name };
}

export async function requireUser(): Promise<SessionUser> {
  const user = await getUser();
  if (!user) throw new UnauthorizedError();
  return user;
}
