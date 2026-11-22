/** Neon's Vercel integration sets DATABASE_URL (and POSTGRES_URL); either works. */
export const databaseUrl = () => process.env.DATABASE_URL || process.env.POSTGRES_URL || "";

/** Neon hosts look like ep-xxx-123456-pooler.us-west-2.aws.neon.tech */
export function isNeonUrl(url: string) {
  try {
    return new URL(url).hostname.endsWith(".neon.tech");
  } catch {
    return false;
  }
}
