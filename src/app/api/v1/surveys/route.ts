import { z } from "zod";
import { LIMITS } from "@/core/survey-schema";
import { requireAdminId } from "@/server/auth/session";
import { handle, ok, readJson } from "@/server/http/handler";
import { createSurvey, listSurveys } from "@/server/surveys/service";

const createSurveySchema = z.object({
  title: z.string().trim().min(1).max(LIMITS.surveyTitle).optional(),
});

export const GET = handle(async (req) => {
  const adminId = await requireAdminId(req);
  return ok(await listSurveys(adminId));
});

export const POST = handle(async (req) => {
  const adminId = await requireAdminId(req);
  const { title } = await readJson(req, createSurveySchema);
  return ok(await createSurvey(adminId, title), { status: 201 });
});
