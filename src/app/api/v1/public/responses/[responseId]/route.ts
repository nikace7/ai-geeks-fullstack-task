import { notFound } from "@/server/http/errors";
import { handle, ok, parseId, readBearerToken, readJson } from "@/server/http/handler";
import { enforceRateLimit, RATE_LIMITS } from "@/server/rate-limit";
import { getResumableResponse, saveResponse, saveResponseSchema } from "@/server/responses/service";

type Context = RouteContext<"/api/v1/public/responses/[responseId]">;

/** The resume token travels in "Authorization: Bearer", never in the URL, so it stays out of logs. */
async function resumeCredentials(req: Request, ctx: Context) {
  const responseId = parseId((await ctx.params).responseId, "Response");
  const token = readBearerToken(req);
  if (!token) throw notFound("Response");
  return { responseId, token };
}

/** Resume: the saved answers plus the exact survey version they belong to. */
export const GET = handle(async (req, ctx: Context) => {
  const { responseId, token } = await resumeCredentials(req, ctx);
  return ok(await getResumableResponse(responseId, token));
});

/** Autosave progress (mode "partial") or submit (mode "complete"). */
export const PUT = handle(async (req, ctx: Context) => {
  await enforceRateLimit(req, RATE_LIMITS.saveResponse);
  const { responseId, token } = await resumeCredentials(req, ctx);
  return ok(await saveResponse(responseId, token, await readJson(req, saveResponseSchema)));
});
