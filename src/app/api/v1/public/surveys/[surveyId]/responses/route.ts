import { randomUUID } from "node:crypto";
import { handle, ok, parseId, readJson } from "@/server/http/handler";
import { enforceRateLimit, RATE_LIMITS } from "@/server/rate-limit";
import { startResponse, startResponseSchema } from "@/server/responses/service";

/** Starts a response (mode "partial", returns a resume token) or submits one in a single step. */
export const POST = handle(async (req, ctx: RouteContext<"/api/v1/public/surveys/[surveyId]/responses">) => {
  await enforceRateLimit(req, RATE_LIMITS.startResponse);
  const surveyId = parseId((await ctx.params).surveyId, "Survey");
  const input = await readJson(req, startResponseSchema);

  if (input.website) {
    // Honeypot tripped: answer like a success so the bot has nothing to adapt to, but store nothing.
    return ok({ responseId: randomUUID(), status: "completed" }, { status: 201 });
  }
  return ok(await startResponse(surveyId, input), { status: 201 });
});
