import { getAdminProfile } from "@/server/auth/service";
import { requireAdminId } from "@/server/auth/session";
import { unauthorized } from "@/server/http/errors";
import { handle, ok } from "@/server/http/handler";

export const GET = handle(async (req) => {
  const admin = await getAdminProfile(await requireAdminId(req));
  // A valid token for an account that no longer exists is treated as signed out.
  if (!admin) throw unauthorized();
  return ok(admin);
});
