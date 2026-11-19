import "server-only";
import { createHmac } from "node:crypto";
import { sql } from "drizzle-orm";
import { db } from "@/server/db/client";
import { rateLimits } from "@/server/db/schema";
import { env } from "@/server/env";
import { tooManyRequests } from "@/server/http/errors";

export interface RateLimitRule {
  name: string;
  limit: number;
  windowSeconds: number;
}

export const RATE_LIMITS = {
  login: { name: "auth:login", limit: 10, windowSeconds: 15 * 60 },
  register: { name: "auth:register", limit: 5, windowSeconds: 60 * 60 },
  startResponse: { name: "responses:start", limit: 20, windowSeconds: 10 * 60 },
  // Autosave fires every few seconds while someone types, so this one is generous.
  saveResponse: { name: "responses:save", limit: 300, windowSeconds: 10 * 60 },
} as const satisfies Record<string, RateLimitRule>;

/**
 * Fixed-window rate limiting backed by Postgres. One atomic upsert either starts a new window
 * or increments the counter, so it stays correct across serverless instances, where an
 * in-memory counter would be per-instance and easy to bypass.
 *
 * ponytail: fixed windows allow up to 2x the limit across a window boundary, and old rows are
 * never pruned (one row per client per rule). Move to Redis/Upstash with a sliding window if
 * traffic grows.
 */
export async function enforceRateLimit(req: Request, rule: RateLimitRule): Promise<void> {
  const key = `${rule.name}:${clientFingerprint(req)}`;
  const windowExpired = sql`${rateLimits.windowStart} <= now() - make_interval(secs => ${rule.windowSeconds})`;

  const [usage] = await db
    .insert(rateLimits)
    .values({ key, count: 1, windowStart: sql`now()` })
    .onConflictDoUpdate({
      target: rateLimits.key,
      set: {
        count: sql`case when ${windowExpired} then 1 else ${rateLimits.count} + 1 end`,
        windowStart: sql`case when ${windowExpired} then now() else ${rateLimits.windowStart} end`,
      },
    })
    .returning({ count: rateLimits.count, windowStart: rateLimits.windowStart });

  if (usage.count > rule.limit) {
    const windowEndsAt = usage.windowStart.getTime() + rule.windowSeconds * 1000;
    throw tooManyRequests(Math.max(1, Math.ceil((windowEndsAt - Date.now()) / 1000)));
  }
}

/**
 * Identifies the client by IP. Vercel sets x-forwarded-for itself, so clients can't spoof it there.
 * The IP is stored as a keyed hash: we only need to count requests, not keep personal data.
 */
function clientFingerprint(req: Request): string {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  return createHmac("sha256", env.JWT_SECRET).update(`rate-limit:${ip}`).digest("base64url").slice(0, 32);
}
