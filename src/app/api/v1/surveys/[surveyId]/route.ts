import { z } from "zod";
import { surveyDefinitionSchema } from "@/core/survey-schema";
import { requireAdminId } from "@/server/auth/session";
import { handle, ok, parseId, readJson } from "@/server/http/handler";
import { deleteSurvey, getSurvey, setSurveyStatus, updateDraft } from "@/server/surveys/service";

type Context = RouteContext<"/api/v1/surveys/[surveyId]">;

const updateDraftSchema = z.object({ draft: surveyDefinitionSchema });
const updateStatusSchema = z.object({ status: z.enum(["published", "closed"]) });

export const GET = handle(async (req, ctx: Context) => {
  const adminId = await requireAdminId(req);
  const surveyId = parseId((await ctx.params).surveyId, "Survey");
  return ok(await getSurvey(adminId, surveyId));
});

/** Replaces the draft. Live respondents keep seeing the published version until the next publish. */
export const PUT = handle(async (req, ctx: Context) => {
  const adminId = await requireAdminId(req);
  const surveyId = parseId((await ctx.params).surveyId, "Survey");
  const { draft } = await readJson(req, updateDraftSchema);
  return ok(await updateDraft(adminId, surveyId, draft));
});

/** Opens or closes the survey to new responses. */
export const PATCH = handle(async (req, ctx: Context) => {
  const adminId = await requireAdminId(req);
  const surveyId = parseId((await ctx.params).surveyId, "Survey");
  const { status } = await readJson(req, updateStatusSchema);
  return ok(await setSurveyStatus(adminId, surveyId, status));
});

export const DELETE = handle(async (req, ctx: Context) => {
  const adminId = await requireAdminId(req);
  const surveyId = parseId((await ctx.params).surveyId, "Survey");
  await deleteSurvey(adminId, surveyId);
  return ok({ id: surveyId });
});
