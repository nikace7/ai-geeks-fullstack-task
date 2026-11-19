import "server-only";
import { and, count, desc, eq, max, sql } from "drizzle-orm";
import { RATING_MAX, RATING_MIN, type Question, type SurveyDefinition } from "@/core/survey-schema";
import { db } from "@/server/db/client";
import { responses, surveys, surveyVersions } from "@/server/db/schema";
import { notFound } from "@/server/http/errors";
import { getSurvey } from "@/server/surveys/service";

/** Newest text answers returned per question. */
export const TEXT_ANSWERS_LIMIT = 50;

export interface VersionSummary {
  versionId: string;
  version: number;
  publishedAt: Date;
  completed: number;
  /** When the newest completed response arrived; null until the first one. */
  lastCompletedAt: Date | null;
}

interface QuestionStatsBase {
  questionId: string;
  title: string;
  /** Completed responses that answered this question (skipped or hidden ones don't count). */
  answered: number;
}

export interface ChoiceStats extends QuestionStatsBase {
  type: "single_choice" | "multi_choice";
  options: { id: string; label: string; count: number }[];
}

export interface RatingStats extends QuestionStatsBase {
  type: "rating";
  average: number | null;
  distribution: { rating: number; count: number }[];
}

export interface TextStats extends QuestionStatsBase {
  type: "text";
  latestAnswers: { value: string; submittedAt: Date }[];
}

export type QuestionStats = ChoiceStats | RatingStats | TextStats;

export interface SurveyAnalytics {
  versions: VersionSummary[];
  /** The version these stats describe; null when the survey was never published. */
  version: number | null;
  /** That version's questions as respondents saw them (conditions, required flags); null when never published. */
  definition: SurveyDefinition | null;
  completed: number;
  inProgress: number;
  questions: QuestionStats[];
}

/**
 * Stats are always for one version: versions are immutable, so every stored answer matches the
 * questions and option ids of the definition it is reported against. Aggregation runs in Postgres
 * (GROUP BY over the JSONB answers), so only counts travel to the app, not every response.
 */
export async function getSurveyAnalytics(
  ownerId: string,
  surveyId: string,
  requestedVersion?: number,
): Promise<SurveyAnalytics> {
  const versions = await db
    .select({
      versionId: surveyVersions.id,
      version: surveyVersions.version,
      publishedAt: surveyVersions.publishedAt,
      completed: count(responses.id),
      lastCompletedAt: max(responses.completedAt),
    })
    .from(surveyVersions)
    .innerJoin(surveys, and(eq(surveys.id, surveyVersions.surveyId), eq(surveys.ownerId, ownerId)))
    .leftJoin(responses, and(eq(responses.versionId, surveyVersions.id), eq(responses.status, "completed")))
    .where(eq(surveyVersions.surveyId, surveyId))
    .groupBy(surveyVersions.id)
    .orderBy(desc(surveyVersions.version));

  if (versions.length === 0) {
    await getSurvey(ownerId, surveyId); // 404 unless it exists and is ours
    return { versions, version: null, definition: null, completed: 0, inProgress: 0, questions: [] };
  }

  const selected = requestedVersion === undefined ? versions[0] : versions.find((v) => v.version === requestedVersion);
  if (!selected) throw notFound("Version");

  const [{ definition }] = await db
    .select({ definition: surveyVersions.definition })
    .from(surveyVersions)
    .where(eq(surveyVersions.id, selected.versionId));

  const [inProgress, answeredCounts, valueCounts, textAnswers] = await Promise.all([
    countInProgress(selected.versionId),
    countAnswered(selected.versionId),
    countValues(selected.versionId, idsOf(definition, ["single_choice", "multi_choice", "rating"])),
    latestTextAnswers(selected.versionId, idsOf(definition, ["text"])),
  ]);

  return {
    versions,
    version: selected.version,
    definition,
    completed: selected.completed,
    inProgress,
    questions: definition.questions.map((question) =>
      buildQuestionStats(question, answeredCounts.get(question.id) ?? 0, valueCounts, textAnswers),
    ),
  };
}

function buildQuestionStats(
  question: Question,
  answered: number,
  valueCounts: Map<string, Map<string, number>>,
  textAnswers: Map<string, TextStats["latestAnswers"]>,
): QuestionStats {
  const base = { questionId: question.id, title: question.title, answered };
  const countOf = (value: string) => valueCounts.get(question.id)?.get(value) ?? 0;

  switch (question.type) {
    case "single_choice":
    case "multi_choice":
      return {
        ...base,
        type: question.type,
        options: question.options.map((option) => ({ ...option, count: countOf(option.id) })),
      };
    case "rating": {
      const distribution = Array.from({ length: RATING_MAX - RATING_MIN + 1 }, (_, i) => {
        const rating = RATING_MIN + i;
        return { rating, count: countOf(String(rating)) };
      });
      const total = distribution.reduce((sum, d) => sum + d.rating * d.count, 0);
      return { ...base, type: "rating", distribution, average: answered ? Math.round((total / answered) * 100) / 100 : null };
    }
    case "text":
      return { ...base, type: "text", latestAnswers: textAnswers.get(question.id) ?? [] };
  }
}

const idsOf = (definition: SurveyDefinition, types: Question["type"][]) =>
  definition.questions.filter((q) => types.includes(q.type)).map((q) => q.id);

// Raw SQL below: lateral JSONB functions are outside Drizzle's query builder. Every value is
// still a bound parameter; sql.param() passes an id list as one text[] parameter.

async function countInProgress(versionId: string): Promise<number> {
  const [row] = await db
    .select({ count: count() })
    .from(responses)
    .where(and(eq(responses.versionId, versionId), eq(responses.status, "in_progress")));
  return row.count;
}

async function countAnswered(versionId: string): Promise<Map<string, number>> {
  const { rows } = await db.execute<{ questionId: string; count: number }>(sql`
    select q.key as "questionId", count(*)::int as "count"
    from responses r cross join lateral jsonb_object_keys(r.answers) as q(key)
    where r.version_id = ${versionId} and r.status = 'completed'
    group by q.key`);
  return new Map(rows.map((row) => [row.questionId, row.count]));
}

/** Counts each answer value per question. A multi-choice array counts once per selected option. */
async function countValues(versionId: string, questionIds: string[]): Promise<Map<string, Map<string, number>>> {
  const { rows } = await db.execute<{ questionId: string; value: string; count: number }>(sql`
    select a.key as "questionId", v.value as "value", count(*)::int as "count"
    from responses r
    cross join lateral jsonb_each(r.answers) as a(key, value)
    cross join lateral jsonb_array_elements_text(
      case when jsonb_typeof(a.value) = 'array' then a.value else jsonb_build_array(a.value) end
    ) as v(value)
    where r.version_id = ${versionId} and r.status = 'completed' and a.key = any(${sql.param(questionIds)}::text[])
    group by a.key, v.value`);

  const counts = new Map<string, Map<string, number>>();
  for (const { questionId, value, count } of rows) {
    counts.set(questionId, (counts.get(questionId) ?? new Map<string, number>()).set(value, count));
  }
  return counts;
}

// ponytail: only the newest TEXT_ANSWERS_LIMIT per question; add a paginated per-question endpoint when admins need them all.
async function latestTextAnswers(versionId: string, questionIds: string[]): Promise<Map<string, TextStats["latestAnswers"]>> {
  // Raw execute() skips Drizzle's column mapping, so timestamps come back as text: ask for ISO 8601.
  const { rows } = await db.execute<{ questionId: string; value: string; submittedAt: string }>(sql`
    select "questionId", "value", "submittedAt" from (
      select a.key as "questionId", a.value #>> '{}' as "value", to_json(r.completed_at) #>> '{}' as "submittedAt",
             row_number() over (partition by a.key order by r.completed_at desc) as rank
      from responses r cross join lateral jsonb_each(r.answers) as a(key, value)
      where r.version_id = ${versionId} and r.status = 'completed' and a.key = any(${sql.param(questionIds)}::text[])
    ) ranked
    where rank <= ${TEXT_ANSWERS_LIMIT}
    order by "submittedAt" desc`);

  const answers = new Map<string, TextStats["latestAnswers"]>();
  for (const { questionId, value, submittedAt } of rows) {
    answers.set(questionId, [...(answers.get(questionId) ?? []), { value, submittedAt: new Date(submittedAt) }]);
  }
  return answers;
}
