import { credentialsSchema, registerAdmin } from "@/server/auth/service";
import { createSessionToken, sessionCookie } from "@/server/auth/session";
import { handle, ok, readJson } from "@/server/http/handler";
import { enforceRateLimit, RATE_LIMITS } from "@/server/rate-limit";

export const POST = handle(async (req) => {
  await enforceRateLimit(req, RATE_LIMITS.register);
  const admin = await registerAdmin(await readJson(req, credentialsSchema));
  const token = await createSessionToken(admin.id);
  return ok(admin, { status: 201, headers: { "Set-Cookie": sessionCookie(token) } });
});
