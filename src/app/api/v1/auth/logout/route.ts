import { clearedSessionCookie } from "@/server/auth/session";
import { handle, ok } from "@/server/http/handler";

export const POST = handle(async () => ok(null, { headers: { "Set-Cookie": clearedSessionCookie() } }));
