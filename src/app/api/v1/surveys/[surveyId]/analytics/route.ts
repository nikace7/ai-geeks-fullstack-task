import { z } from "zod";
import { getSurveyAnalytics } from "@/server/analytics/service";
import { requireAdminId } from "@/server/auth/session";
import { handle, ok, parseId, readQuery } from "@/server/http/handler";

const analyticsQuerySchema = z.object({
  /** Defaults to the latest published version. */
  version: z.coerce.number().int().positive().optional(),
});

export const GET = handle(async (req, ctx: RouteContext<"/api/v1/surveys/[surveyId]/analytics">) => {
  const adminId = await requireAdminId(req);
  const surveyId = parseId((await ctx.params).surveyId, "Survey");
  const { version } = readQuery(req, analyticsQuerySchema);
  return ok(await getSurveyAnalytics(adminId, surveyId, version));
});
