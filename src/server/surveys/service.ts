import "server-only";
import { isDeepStrictEqual } from "node:util";
import { and, count, desc, eq, sql } from "drizzle-orm";
import { toFieldErrors } from "@/lib/api-contract";
import { createEmptySurvey, surveyDefinitionSchema, type SurveyDefinition } from "@/core/survey-schema";
import { db } from "@/server/db/client";
import { responses, surveys, surveyVersions } from "@/server/db/schema";
import { conflict, notFound, validationFailed } from "@/server/http/errors";

export type SurveyStatus = (typeof surveys.$inferSelect)["status"];

export interface SurveySummary {
  id: string;
  title: string;
  status: SurveyStatus;
  latestVersion: number | null;
  responseCount: number;
  updatedAt: Date;
}

export interface SurveyDetail {
  id: string;
  status: SurveyStatus;
  latestVersion: number | null;
  draft: SurveyDefinition;
  /** True when the draft differs from what respondents currently see. */
  hasUnpublishedChanges: boolean;
  updatedAt: Date;
}

export interface PublishedVersion {
  versionId: string;
  version: number;
  publishedAt: Date;
}

export interface PublicSurvey {
  surveyId: string;
  versionId: string;
  status: Exclude<SurveyStatus, "draft">;
  definition: SurveyDefinition;
}

/** Every admin query is scoped by owner, so another admin's survey is indistinguishable from a missing one. */
const ownedBy = (surveyId: string, ownerId: string) => and(eq(surveys.id, surveyId), eq(surveys.ownerId, ownerId));

// Joins rather than correlated subqueries: in a single-table select Drizzle renders columns
// inside sql`` unqualified, so a subquery's "id" would silently bind to the inner table.
const latestVersionJoin = and(eq(surveyVersions.surveyId, surveys.id), eq(surveyVersions.version, surveys.latestVersion));

// ponytail: unpaginated; add cursor pagination on (updated_at, id) once an admin has hundreds of surveys.
export function listSurveys(ownerId: string): Promise<SurveySummary[]> {
  return db
    .select({
      id: surveys.id,
      title: sql<string>`${surveys.draft}->>'title'`,
      status: surveys.status,
      latestVersion: surveys.latestVersion,
      responseCount: count(responses.id),
      updatedAt: surveys.updatedAt,
    })
    .from(surveys)
    .leftJoin(responses, and(eq(responses.surveyId, surveys.id), eq(responses.status, "completed")))
    .where(eq(surveys.ownerId, ownerId))
    .groupBy(surveys.id)
    .orderBy(desc(surveys.updatedAt));
}

export async function createSurvey(ownerId: string, title?: string): Promise<SurveyDetail> {
  const draft = { ...createEmptySurvey(), ...(title && { title }) };
  const [survey] = await db.insert(surveys).values({ ownerId, draft }).returning({ id: surveys.id });
  return getSurvey(ownerId, survey.id);
}

export async function getSurvey(ownerId: string, surveyId: string): Promise<SurveyDetail> {
  const [survey] = await db
    .select({
      id: surveys.id,
      status: surveys.status,
      latestVersion: surveys.latestVersion,
      draft: surveys.draft,
      // Compared inside Postgres: jsonb equality ignores key order. Never published → null → true.
      hasUnpublishedChanges: sql<boolean>`${surveys.draft} is distinct from ${surveyVersions.definition}`,
      updatedAt: surveys.updatedAt,
    })
    .from(surveys)
    .leftJoin(surveyVersions, latestVersionJoin)
    .where(ownedBy(surveyId, ownerId));
  if (!survey) throw notFound("Survey");
  return survey;
}

/**
 * Replaces the working draft. The draft is fully validated on every save, so whatever is in the
 * database can always be published or previewed. Respondents are unaffected until the next publish.
 *
 * ponytail: last write wins if the same survey is edited in two tabs at once. Add optimistic
 * locking (send the loaded updatedAt, update only if it still matches) if that becomes a real case.
 */
export async function updateDraft(ownerId: string, surveyId: string, draft: SurveyDefinition): Promise<SurveyDetail> {
  const [updated] = await db
    .update(surveys)
    .set({ draft })
    .where(ownedBy(surveyId, ownerId))
    .returning({ id: surveys.id });
  if (!updated) throw notFound("Survey");
  return getSurvey(ownerId, surveyId);
}

export async function deleteSurvey(ownerId: string, surveyId: string): Promise<void> {
  const [deleted] = await db.delete(surveys).where(ownedBy(surveyId, ownerId)).returning({ id: surveys.id });
  if (!deleted) throw notFound("Survey");
}

/**
 * Publishes the draft as a new immutable version. Responses already collected stay attached to the
 * version they answered, so editing a live survey can never corrupt existing data.
 * Publishing an unchanged draft reuses the latest version instead of creating an identical one.
 */
export function publishSurvey(ownerId: string, surveyId: string): Promise<PublishedVersion> {
  return db.transaction(async (tx) => {
    // Row lock: two simultaneous publishes are serialised instead of racing for the same version number.
    const [survey] = await tx
      .select({ draft: surveys.draft, latestVersion: surveys.latestVersion })
      .from(surveys)
      .where(ownedBy(surveyId, ownerId))
      .for("update");
    if (!survey) throw notFound("Survey");

    // Re-check what is about to go live, in case validation rules changed since the draft was saved.
    const parsed = surveyDefinitionSchema.safeParse(survey.draft);
    if (!parsed.success) throw validationFailed(toFieldErrors(parsed.error), "Fix the survey before publishing");
    if (parsed.data.questions.length === 0) {
      throw validationFailed({ questions: "Add at least one question before publishing" });
    }

    const [latest] =
      survey.latestVersion === null
        ? []
        : await tx
            .select()
            .from(surveyVersions)
            .where(and(eq(surveyVersions.surveyId, surveyId), eq(surveyVersions.version, survey.latestVersion)));

    let published = latest;
    if (!latest || !isDeepStrictEqual(latest.definition, parsed.data)) {
      [published] = await tx
        .insert(surveyVersions)
        .values({ surveyId, version: (survey.latestVersion ?? 0) + 1, definition: parsed.data })
        .returning();
    }

    await tx
      .update(surveys)
      .set({ status: "published", latestVersion: published.version })
      .where(eq(surveys.id, surveyId));
    return { versionId: published.id, version: published.version, publishedAt: published.publishedAt };
  });
}

/** Closes a live survey to new responses, or reopens a closed one on its latest version. */
export async function setSurveyStatus(
  ownerId: string,
  surveyId: string,
  status: "published" | "closed",
): Promise<SurveyDetail> {
  const survey = await getSurvey(ownerId, surveyId);
  if (survey.latestVersion === null) throw conflict("Publish the survey first", "NOT_PUBLISHED");
  await db.update(surveys).set({ status }).where(ownedBy(surveyId, ownerId));
  return { ...survey, status };
}

/** What respondents see: the latest published version. Null for unknown or never-published surveys. */
export async function getPublicSurvey(surveyId: string): Promise<PublicSurvey | null> {
  const [survey] = await db
    .select({
      surveyId: surveys.id,
      status: surveys.status,
      versionId: surveyVersions.id,
      definition: surveyVersions.definition,
    })
    .from(surveys)
    .innerJoin(surveyVersions, latestVersionJoin)
    .where(eq(surveys.id, surveyId));
  if (!survey || survey.status === "draft") return null;
  return { ...survey, status: survey.status };
}
