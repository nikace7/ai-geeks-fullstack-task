import "server-only";
import { jwtVerify, SignJWT } from "jose";
import { env, isProduction } from "@/server/env";
import { unauthorized } from "@/server/http/errors";

/**
 * Stateless sessions: a signed JWT (HS256) holding the admin id, stored in an httpOnly cookie.
 * Trade-off: a token can't be revoked before it expires (7 days). A per-admin "token version"
 * column checked on each request would add revocation if it's ever needed.
 */
export const SESSION_COOKIE = "session";
const SESSION_TTL_SECONDS = 60 * 60 * 24 * 7;
const secretKey = new TextEncoder().encode(env.JWT_SECRET);

export function createSessionToken(adminId: string): Promise<string> {
  return new SignJWT({})
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(adminId)
    .setIssuedAt()
    .setExpirationTime(`${SESSION_TTL_SECONDS}s`)
    .sign(secretKey);
}

/** Returns the admin id, or null for a missing, tampered or expired token. */
export async function verifySessionToken(token: string | undefined): Promise<string | null> {
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, secretKey, { algorithms: ["HS256"] });
    return typeof payload.sub === "string" ? payload.sub : null;
  } catch {
    return null;
  }
}

/**
 * HttpOnly: page scripts can't read the cookie, so an XSS bug can't steal the session.
 * SameSite=Lax: the browser won't attach it to cross-site POST/PUT/DELETE requests (CSRF).
 * Secure in production: only sent over HTTPS. (Browsers treat http://localhost as secure anyway.)
 */
export function sessionCookie(token: string): string {
  return serializeSessionCookie(token, SESSION_TTL_SECONDS);
}

export function clearedSessionCookie(): string {
  return serializeSessionCookie("", 0);
}

function serializeSessionCookie(value: string, maxAgeSeconds: number): string {
  const attributes = [`${SESSION_COOKIE}=${value}`, "Path=/", "HttpOnly", "SameSite=Lax", `Max-Age=${maxAgeSeconds}`];
  if (isProduction) attributes.push("Secure");
  return attributes.join("; ");
}

export function readCookie(req: Request, name: string): string | undefined {
  const header = req.headers.get("cookie");
  if (!header) return undefined;
  for (const pair of header.split(";")) {
    const [key, ...rest] = pair.trim().split("=");
    if (key === name) return rest.join("=");
  }
  return undefined;
}

/** For route handlers: the signed-in admin's id, or a 401 error. */
export async function requireAdminId(req: Request): Promise<string> {
  const adminId = await verifySessionToken(readCookie(req, SESSION_COOKIE));
  if (!adminId) throw unauthorized();
  return adminId;
}
