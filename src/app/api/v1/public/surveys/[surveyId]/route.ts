import { notFound } from "@/server/http/errors";
import { handle, ok, parseId } from "@/server/http/handler";
import { getPublicSurvey } from "@/server/surveys/service";

/** No sign-in: anyone with the link can load the latest published version. */
export const GET = handle(async (_req, ctx: RouteContext<"/api/v1/public/surveys/[surveyId]">) => {
  const survey = await getPublicSurvey(parseId((await ctx.params).surveyId, "Survey"));
  if (!survey) throw notFound("Survey");
  return ok(survey);
});
