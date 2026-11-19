import { requireAdminId } from "@/server/auth/session";
import { handle, ok, parseId } from "@/server/http/handler";
import { publishSurvey } from "@/server/surveys/service";

export const POST = handle(async (req, ctx: RouteContext<"/api/v1/surveys/[surveyId]/publish">) => {
  const adminId = await requireAdminId(req);
  const surveyId = parseId((await ctx.params).surveyId, "Survey");
  return ok(await publishSurvey(adminId, surveyId));
});
