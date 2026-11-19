import "server-only";
import { createHash, randomBytes } from "node:crypto";
import { and, eq, sql } from "drizzle-orm";
import { z } from "zod";
import type { Answers, SurveyDefinition } from "@/core/survey-schema";
import { validateResponse, type ResponseMode } from "@/core/validate-response";
import { db } from "@/server/db/client";
import { responses, surveys, surveyVersions } from "@/server/db/schema";
import { conflict, notFound, validationFailed } from "@/server/http/errors";

/**
 * Anonymous responses with optional save-and-resume.
 *
 * A partial save returns a random resume token once. The respondent's browser keeps it; the
 * database keeps only its SHA-256 hash, so a database leak can't be used to edit anyone's answers.
 * (A fast hash is fine here: the token is 256 random bits, so there is nothing to brute-force.)
 */

const responseBodySchema = z.object({
  // Answer shapes are checked against the survey version by validateResponse, not here.
  answers: z.record(z.string(), z.unknown()),
  mode: z.enum(["partial", "complete"]),
});

export const startResponseSchema = responseBodySchema.extend({
  versionId: z.uuid(),
  /** Honeypot: hidden from humans by CSS, so only bots fill it in. */
  website: z.string().optional(),
});
export type StartResponseInput = z.infer<typeof startResponseSchema>;

export const saveResponseSchema = responseBodySchema;
export type SaveResponseInput = z.infer<typeof saveResponseSchema>;

export type ResponseStatus = (typeof responses.$inferSelect)["status"];

export interface SavedResponse {
  responseId: string;
  status: ResponseStatus;
  /** Present while the response is in progress; needed to resume or submit it later. */
  resumeToken?: string;
}

export interface ResumableResponse {
  responseId: string;
  surveyId: string;
  versionId: string;
  status: ResponseStatus;
  acceptingResponses: boolean;
  definition: SurveyDefinition;
  answers: Answers;
}

const hashToken = (token: string) => createHash("sha256").update(token).digest("base64url");

function acceptedAnswers(definition: SurveyDefinition, input: Record<string, unknown>, mode: ResponseMode): Answers {
  const result = validateResponse(definition, input, mode);
  if (!result.success) throw validationFailed(result.errors, "Please check the highlighted questions");
  return result.answers;
}

const surveyClosed = () => conflict("This survey is no longer accepting responses", "SURVEY_CLOSED");
const alreadySubmitted = () => conflict("This response has already been submitted", "ALREADY_SUBMITTED");

/**
 * Starts (or, in one step, completes) a response. Any published version of the survey is accepted,
 * so someone halfway through when the admin publishes changes can still finish the version they saw.
 */
export async function startResponse(surveyId: string, input: StartResponseInput): Promise<SavedResponse> {
  const [version] = await db
    .select({ definition: surveyVersions.definition, surveyStatus: surveys.status })
    .from(surveyVersions)
    .innerJoin(surveys, eq(surveys.id, surveyVersions.surveyId))
    .where(and(eq(surveyVersions.id, input.versionId), eq(surveyVersions.surveyId, surveyId)));
  if (!version) throw notFound("Survey");
  if (version.surveyStatus !== "published") throw surveyClosed();

  const answers = acceptedAnswers(version.definition, input.answers, input.mode);
  const isComplete = input.mode === "complete";
  const resumeToken = isComplete ? undefined : randomBytes(32).toString("base64url");

  const [created] = await db
    .insert(responses)
    .values({
      surveyId,
      versionId: input.versionId,
      status: isComplete ? "completed" : "in_progress",
      answers,
      resumeTokenHash: resumeToken ? hashToken(resumeToken) : null,
      completedAt: isComplete ? sql`now()` : null,
    })
    .returning({ id: responses.id, status: responses.status });
  return { responseId: created.id, status: created.status, ...(resumeToken && { resumeToken }) };
}

/** Loads a response for whoever holds its token, so the form can restore progress or say "already submitted". */
export async function getResumableResponse(responseId: string, resumeToken: string): Promise<ResumableResponse> {
  const [found] = await db
    .select({
      responseId: responses.id,
      surveyId: responses.surveyId,
      versionId: responses.versionId,
      status: responses.status,
      surveyStatus: surveys.status,
      definition: surveyVersions.definition,
      answers: responses.answers,
    })
    .from(responses)
    .innerJoin(surveyVersions, eq(surveyVersions.id, responses.versionId))
    .innerJoin(surveys, eq(surveys.id, responses.surveyId))
    // The token check is part of the lookup: a wrong token looks exactly like a missing response.
    .where(and(eq(responses.id, responseId), eq(responses.resumeTokenHash, hashToken(resumeToken))));
  if (!found) throw notFound("Response");
  const { surveyStatus, ...response } = found;
  return { ...response, acceptingResponses: surveyStatus === "published" };
}

/** Autosaves progress, or submits the response when mode is "complete". */
export async function saveResponse(
  responseId: string,
  resumeToken: string,
  input: SaveResponseInput,
): Promise<SavedResponse> {
  const existing = await getResumableResponse(responseId, resumeToken);
  if (existing.status === "completed") throw alreadySubmitted();
  if (!existing.acceptingResponses) throw surveyClosed();

  const answers = acceptedAnswers(existing.definition, input.answers, input.mode);
  const isComplete = input.mode === "complete";
  const [saved] = await db
    .update(responses)
    .set({ answers, ...(isComplete && { status: "completed", completedAt: sql`now()` }) })
    // Completed responses are final; this also stops a double submit racing past the check above.
    .where(and(eq(responses.id, responseId), eq(responses.status, "in_progress")))
    .returning({ status: responses.status });
  if (!saved) throw alreadySubmitted();
  return { responseId, status: saved.status, ...(!isComplete && { resumeToken }) };
}
