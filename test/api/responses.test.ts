import { describe, expect, it } from "vitest";
import { GET as resume, PUT as save } from "@/app/api/v1/public/responses/[responseId]/route";
import { GET as getAnalytics } from "@/app/api/v1/surveys/[surveyId]/analytics/route";
import { POST as publish } from "@/app/api/v1/surveys/[surveyId]/publish/route";
import { PATCH as setStatus, PUT as saveDraft } from "@/app/api/v1/surveys/[surveyId]/route";
import type { SurveyAnalytics } from "@/server/analytics/service";
import { RATE_LIMITS } from "@/server/rate-limit";
import type { ResumableResponse, SavedResponse } from "@/server/responses/service";
import { cloneSurvey } from "../fixtures/survey";
import { call, dataOf, expectError, publishedSurvey, respond, signUp } from "./client";

/** A respondent's partial response, with the token their browser would keep. */
async function startPartial(surveyId: string, versionId: string, answers: Record<string, unknown> = {}) {
  const res = await respond(surveyId, { versionId, answers, mode: "partial" });
  const started = dataOf(res);
  expect([res.status, started.status]).toEqual([201, "in_progress"]);
  if (!started.resumeToken) throw new Error("A partial response must return a resume token");
  return { params: { responseId: started.responseId }, token: started.resumeToken };
}

describe("responses API", () => {
  it("saves progress, resumes it with the token, then submits once", async () => {
    const { surveyId, versionId } = await publishedSurvey(await signUp());
    const { params, token } = await startPartial(surveyId, versionId, { q_used: "yes" });

    const resumed = dataOf(await call<ResumableResponse>(resume, "GET", { params, token }));
    expect(resumed).toMatchObject({
      versionId,
      status: "in_progress",
      acceptingResponses: true,
      answers: { q_used: "yes" },
      definition: { title: "Customer feedback" },
      completedAt: null,
    });

    const answers = { q_used: "yes", q_rating: 4 };
    expect(dataOf(await call<SavedResponse>(save, "PUT", { params, token, body: { answers, mode: "partial" } }))).toMatchObject({
      status: "in_progress",
    });
    const submitted = dataOf(await call<SavedResponse>(save, "PUT", { params, token, body: { answers, mode: "complete" } }));
    expect(submitted).toEqual({ responseId: params.responseId, status: "completed" });

    // Final: a second submit is refused, and the token now only shows that it was submitted.
    expectError(await call(save, "PUT", { params, token, body: { answers, mode: "complete" } }), 409, "ALREADY_SUBMITTED");
    expect(dataOf(await call<ResumableResponse>(resume, "GET", { params, token }))).toMatchObject({
      status: "completed",
      answers,
      completedAt: expect.any(String),
    });
  });

  it("hides a response from anyone without its token", async () => {
    const { surveyId, versionId } = await publishedSurvey(await signUp());
    const { params } = await startPartial(surveyId, versionId);
    const body = { answers: {}, mode: "partial" };

    expectError(await call(resume, "GET", { params }), 404, "NOT_FOUND");
    expectError(await call(resume, "GET", { params, token: "wrong-token" }), 404, "NOT_FOUND");
    expectError(await call(save, "PUT", { params, token: "wrong-token", body }), 404, "NOT_FOUND");
  });

  it("requires only the required questions that are actually shown", async () => {
    const { surveyId, versionId } = await publishedSurvey(await signUp());
    const submit = (answers: Record<string, unknown>) => respond(surveyId, { versionId, answers, mode: "complete" });

    expect(expectError(await submit({}), 422, "VALIDATION_FAILED")).toEqual({ q_used: "This question is required" });
    // "yes" reveals the rating, which is required too.
    expect(expectError(await submit({ q_used: "yes" }), 422, "VALIDATION_FAILED")).toEqual({
      q_rating: "This question is required",
    });
    // "no" keeps it hidden, so the response is complete without it.
    expect(dataOf(await submit({ q_used: "no" })).status).toBe("completed");
  });

  it("rejects answers of the wrong shape", async () => {
    const { surveyId, versionId } = await publishedSurvey(await signUp());
    const res = await respond(surveyId, {
      versionId,
      answers: { q_used: "maybe", q_features: ["f_api", "f_unknown"], q_comments: 42 },
      mode: "partial",
    });
    expect(Object.keys(expectError(res, 422, "VALIDATION_FAILED")).sort()).toEqual(["q_comments", "q_features", "q_used"]);
  });

  it("stores only answers to questions the respondent could see", async () => {
    const { surveyId, versionId } = await publishedSurvey(await signUp());
    const { params, token } = await startPartial(surveyId, versionId, {
      q_used: "no",
      q_rating: 5, // hidden: only shown after "yes"
      q_unknown: "not in this survey",
      q_comments: "  trimmed  ",
    });

    expect(dataOf(await call<ResumableResponse>(resume, "GET", { params, token })).answers).toEqual({
      q_used: "no",
      q_comments: "trimmed",
    });
  });

  it("lets a respondent finish the version they started after a new one is published", async () => {
    const session = await signUp();
    const { surveyId, versionId: v1 } = await publishedSurvey(session);
    const { params, token } = await startPartial(surveyId, v1, { q_used: "no" });

    // v2 drops the comments question.
    const draft = cloneSurvey();
    await call(saveDraft, "PUT", { session, params: { surveyId }, body: { draft: { ...draft, questions: draft.questions.slice(0, 4) } } });
    dataOf(await call(publish, "POST", { session, params: { surveyId } }));

    const answers = { q_used: "no", q_comments: "Still on v1" };
    dataOf(await call(save, "PUT", { params, token, body: { answers, mode: "complete" } }));
    expect(dataOf(await call<ResumableResponse>(resume, "GET", { params, token }))).toMatchObject({ versionId: v1, answers });

    const v1Stats = dataOf(await call<SurveyAnalytics>(getAnalytics, "GET", { session, params: { surveyId }, query: { version: "1" } }));
    const v2Stats = dataOf(await call<SurveyAnalytics>(getAnalytics, "GET", { session, params: { surveyId } }));
    expect([v1Stats.completed, v2Stats.completed]).toEqual([1, 0]);
  });

  it("refuses a version that belongs to another survey", async () => {
    const session = await signUp();
    const first = await publishedSurvey(session);
    const second = await publishedSurvey(session);
    const res = await respond(first.surveyId, { versionId: second.versionId, answers: {}, mode: "partial" });
    expectError(res, 404, "NOT_FOUND");
  });

  it("stops saving once the survey closes", async () => {
    const session = await signUp();
    const { surveyId, versionId } = await publishedSurvey(session);
    const { params, token } = await startPartial(surveyId, versionId);

    await call(setStatus, "PATCH", { session, params: { surveyId }, body: { status: "closed" } });
    expectError(await call(save, "PUT", { params, token, body: { answers: {}, mode: "partial" } }), 409, "SURVEY_CLOSED");
    expect(dataOf(await call<ResumableResponse>(resume, "GET", { params, token })).acceptingResponses).toBe(false);
  });

  it("answers a bot that fills the honeypot like a success, but stores nothing", async () => {
    const session = await signUp();
    const { surveyId, versionId } = await publishedSurvey(session);

    const res = await respond(surveyId, { versionId, answers: { q_used: "no" }, mode: "complete", website: "https://spam.example" });
    expect(res.status).toBe(201);
    expect(dataOf(res).status).toBe("completed");
    expect(dataOf(await call<SurveyAnalytics>(getAnalytics, "GET", { session, params: { surveyId } })).completed).toBe(0);
  });

  it("rate-limits starting new responses", async () => {
    const { surveyId, versionId } = await publishedSurvey(await signUp());
    const start = () => respond(surveyId, { versionId, answers: {}, mode: "partial" });

    for (let i = 0; i < RATE_LIMITS.startResponse.limit; i++) expect((await start()).status).toBe(201);
    expectError(await start(), 429, "RATE_LIMITED");
  });
});
