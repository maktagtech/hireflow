import "server-only";
import { HttpError } from "./api";

/**
 * Fixed-window in-memory limiter. Per-instance only — swap for Redis when
 * running more than one server. Protects login and AI spend.
 */
const buckets = new Map<string, { count: number; resetAt: number }>();

export function rateLimit(key: string, limit: number, windowMs: number) {
  const now = Date.now();
  const b = buckets.get(key);
  if (!b || b.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return;
  }
  if (++b.count > limit) {
    throw new HttpError(429, `Too many requests. Try again in ${Math.ceil((b.resetAt - now) / 1000)}s.`);
  }
}
