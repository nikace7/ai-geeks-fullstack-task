import { describe, expect, it } from "vitest";
import { GET as getAnalytics } from "@/app/api/v1/surveys/[surveyId]/analytics/route";
import { POST as publish } from "@/app/api/v1/surveys/[surveyId]/publish/route";
import { PUT as saveDraft } from "@/app/api/v1/surveys/[surveyId]/route";
import { POST as createSurvey } from "@/app/api/v1/surveys/route";
import type { QuestionStats, SurveyAnalytics } from "@/server/analytics/service";
import type { SurveyDetail } from "@/server/surveys/service";
import { cloneSurvey } from "../fixtures/survey";
import { call, dataOf, expectError, publishedSurvey, respond, signUp } from "./client";

const analytics = (session: string, surveyId: string, version?: string) =>
  call<SurveyAnalytics>(getAnalytics, "GET", { session, params: { surveyId }, query: version ? { version } : {} });

function statsFor<T extends QuestionStats["type"]>(result: SurveyAnalytics, questionId: string, type: T) {
  const stats = result.questions.find((q) => q.questionId === questionId);
  if (stats?.type !== type) throw new Error(`No ${type} stats for ${questionId}`);
  // An intersection, not Extract: ChoiceStats covers two types, so Extract would drop it.
  return stats as QuestionStats & { type: T };
}

describe("analytics API", () => {
  it("counts completed responses per question for the latest version", async () => {
    const session = await signUp();
    const { surveyId, versionId } = await publishedSurvey(session);
    const submit = (answers: Record<string, unknown>) =>
      respond(surveyId, { versionId, answers, mode: "complete" }).then(dataOf);

    await submit({ q_used: "yes", q_rating: 5, q_features: ["f_reports", "f_api"], q_comments: "Love it" });
    await submit({ q_used: "yes", q_rating: 2, q_improve: "Faster exports", q_features: ["f_exports"] });
    await submit({ q_used: "no", q_features: ["f_reports"] });
    // In progress: shows up as "in progress", never in the per-question numbers.
    dataOf(await respond(surveyId, { versionId, answers: { q_used: "yes", q_rating: 1 }, mode: "partial" }));

    const result = dataOf(await analytics(session, surveyId));
    expect(result).toMatchObject({ version: 1, completed: 3, inProgress: 1 });

    const used = statsFor(result, "q_used", "single_choice");
    expect(used.answered).toBe(3);
    expect(used.options.map((o) => [o.id, o.count])).toEqual([["yes", 2], ["no", 1]]);

    // Each selected option counts once, so the counts can add up to more than the responses.
    const features = statsFor(result, "q_features", "multi_choice");
    expect(features.options.map((o) => [o.id, o.count])).toEqual([["f_reports", 2], ["f_exports", 1], ["f_api", 1]]);

    // Averaged over those who were shown and answered the rating, not over all responses.
    const rating = statsFor(result, "q_rating", "rating");
    expect(rating).toMatchObject({ answered: 2, average: 3.5 });
    expect(rating.distribution.map((d) => d.count)).toEqual([0, 1, 0, 0, 1]);

    expect(statsFor(result, "q_improve", "text").latestAnswers.map((a) => a.value)).toEqual(["Faster exports"]);
    expect(statsFor(result, "q_comments", "text").latestAnswers.map((a) => a.value)).toEqual(["Love it"]);
  });

  it("reports each version separately", async () => {
    const session = await signUp();
    const { surveyId, versionId: v1 } = await publishedSurvey(session);
    await respond(surveyId, { versionId: v1, answers: { q_used: "no" }, mode: "complete" }).then(dataOf);
    await respond(surveyId, { versionId: v1, answers: { q_used: "no" }, mode: "complete" }).then(dataOf);

    const draft = { ...cloneSurvey(), title: "Customer feedback v2" };
    await call(saveDraft, "PUT", { session, params: { surveyId }, body: { draft } }).then(dataOf);
    const { versionId: v2 } = dataOf(await call<{ versionId: string }>(publish, "POST", { session, params: { surveyId } }));
    await respond(surveyId, { versionId: v2, answers: { q_used: "yes", q_rating: 3 }, mode: "complete" }).then(dataOf);

    const latest = dataOf(await analytics(session, surveyId));
    expect(latest).toMatchObject({ version: 2, completed: 1, definition: { title: "Customer feedback v2" } });
    expect(latest.versions.map((v) => [v.version, v.completed])).toEqual([[2, 1], [1, 2]]);

    expect(dataOf(await analytics(session, surveyId, "1"))).toMatchObject({ version: 1, completed: 2 });
    expectError(await analytics(session, surveyId, "9"), 404, "NOT_FOUND");
    expectError(await analytics(session, surveyId, "zero"), 422, "VALIDATION_FAILED");
  });

  it("returns empty stats for a survey that was never published", async () => {
    const session = await signUp();
    const { id: surveyId } = dataOf(await call<SurveyDetail>(createSurvey, "POST", { session, body: {} }));
    expect(dataOf(await analytics(session, surveyId))).toEqual({
      versions: [],
      version: null,
      definition: null,
      completed: 0,
      inProgress: 0,
      questions: [],
    });
  });

  it("only shows a survey's results to its owner", async () => {
    const { surveyId } = await publishedSurvey(await signUp("owner@example.com"));
    expectError(await analytics(await signUp("other@example.com"), surveyId), 404, "NOT_FOUND");
  });
});
