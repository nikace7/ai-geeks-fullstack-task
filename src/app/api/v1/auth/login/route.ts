import { authenticateAdmin, credentialsSchema } from "@/server/auth/service";
import { createSessionToken, sessionCookie } from "@/server/auth/session";
import { handle, ok, readJson } from "@/server/http/handler";
import { enforceRateLimit, RATE_LIMITS } from "@/server/rate-limit";

export const POST = handle(async (req) => {
  // Counted before checking the password, so failed guesses use up the budget too.
  await enforceRateLimit(req, RATE_LIMITS.login);
  const admin = await authenticateAdmin(await readJson(req, credentialsSchema));
  const token = await createSessionToken(admin.id);
  return ok(admin, { headers: { "Set-Cookie": sessionCookie(token) } });
});
