import { describe, expect, it } from "vitest";
import { GET as getPublicSurvey } from "@/app/api/v1/public/surveys/[surveyId]/route";
import { POST as publish } from "@/app/api/v1/surveys/[surveyId]/publish/route";
import { DELETE as deleteSurvey, GET as getSurvey, PATCH as setStatus, PUT as saveDraft } from "@/app/api/v1/surveys/[surveyId]/route";
import { GET as listSurveys, POST as createSurvey } from "@/app/api/v1/surveys/route";
import type { PublishedVersion, PublicSurvey, SurveyDetail, SurveySummary } from "@/server/surveys/service";
import { cloneSurvey } from "../fixtures/survey";
import { call, dataOf, expectError, publishedSurvey, respond, signUp } from "./client";

describe("surveys API", () => {
  it("publishes the draft as immutable versions, and respondents only ever see a published one", async () => {
    const session = await signUp();
    const created = dataOf(await call<SurveyDetail>(createSurvey, "POST", { session, body: { title: "Team pulse" } }));
    const params = { surveyId: created.id };
    expect(created).toMatchObject({ status: "draft", latestVersion: null, published: null, draft: { title: "Team pulse" } });
    expectError(await call(getPublicSurvey, "GET", { params }), 404, "NOT_FOUND");

    const v1Draft = { ...cloneSurvey(), title: "Team pulse" };
    const saved = dataOf(await call<SurveyDetail>(saveDraft, "PUT", { session, params, body: { draft: v1Draft } }));
    expect(saved.hasUnpublishedChanges).toBe(true);

    const v1 = dataOf(await call<PublishedVersion>(publish, "POST", { session, params }));
    expect(v1.version).toBe(1);
    // Publishing again with no changes reuses the version instead of adding an identical one.
    expect(dataOf(await call<PublishedVersion>(publish, "POST", { session, params }))).toEqual(v1);

    // Editing the draft doesn't touch what respondents see until the next publish.
    const v2Draft = { ...v1Draft, title: "Team pulse, round two" };
    await call(saveDraft, "PUT", { session, params, body: { draft: v2Draft } });
    expect(dataOf(await call<PublicSurvey>(getPublicSurvey, "GET", { params }))).toMatchObject({
      versionId: v1.versionId,
      status: "published",
      definition: { title: "Team pulse" },
    });

    const v2 = dataOf(await call<PublishedVersion>(publish, "POST", { session, params }));
    expect(v2.version).toBe(2);
    expect(dataOf(await call<PublicSurvey>(getPublicSurvey, "GET", { params }))).toMatchObject({
      versionId: v2.versionId,
      definition: { title: "Team pulse, round two" },
    });
    expect(dataOf(await call<SurveyDetail>(getSurvey, "GET", { session, params }))).toMatchObject({
      latestVersion: 2,
      hasUnpublishedChanges: false,
    });
  });

  it("rejects an invalid draft with the path of each problem", async () => {
    const session = await signUp();
    const { id: surveyId } = dataOf(await call<SurveyDetail>(createSurvey, "POST", { session, body: {} }));
    const draft = cloneSurvey();
    draft.questions[0].title = " ";
    draft.questions[3].id = draft.questions[0].id;

    const res = await call(saveDraft, "PUT", { session, params: { surveyId }, body: { draft } });
    const fields = expectError(res, 422, "VALIDATION_FAILED");
    expect(fields).toMatchObject({
      "draft.questions.0.title": "Question text is required",
      "draft.questions.3.id": "Duplicate question id",
    });
  });

  it("won't publish a survey with no questions", async () => {
    const session = await signUp();
    const { id: surveyId } = dataOf(await call<SurveyDetail>(createSurvey, "POST", { session, body: {} }));
    const fields = expectError(await call(publish, "POST", { session, params: { surveyId } }), 422, "VALIDATION_FAILED");
    expect(fields).toHaveProperty("questions");
  });

  it("keeps each admin's surveys invisible to other admins", async () => {
    const owner = await signUp("owner@example.com");
    const other = await signUp("other@example.com");
    const { surveyId } = await publishedSurvey(owner);
    const params = { surveyId };

    expectError(await call(getSurvey, "GET", { session: other, params }), 404, "NOT_FOUND");
    expectError(await call(saveDraft, "PUT", { session: other, params, body: { draft: cloneSurvey() } }), 404, "NOT_FOUND");
    expectError(await call(setStatus, "PATCH", { session: other, params, body: { status: "closed" } }), 404, "NOT_FOUND");
    expectError(await call(deleteSurvey, "DELETE", { session: other, params }), 404, "NOT_FOUND");
    expect(dataOf(await call<SurveySummary[]>(listSurveys, "GET", { session: other }))).toEqual([]);
    expect(dataOf(await call<SurveySummary[]>(listSurveys, "GET", { session: owner }))).toHaveLength(1);
  });

  it("answers a malformed id with 404, not a database error", async () => {
    const session = await signUp();
    expectError(await call(getSurvey, "GET", { session, params: { surveyId: "not-a-uuid" } }), 404, "NOT_FOUND");
    expectError(await call(getPublicSurvey, "GET", { params: { surveyId: "not-a-uuid" } }), 404, "NOT_FOUND");
  });

  it("closes a survey to new responses and reopens it", async () => {
    const session = await signUp();
    const { surveyId, versionId } = await publishedSurvey(session);
    const params = { surveyId };
    const answers = { q_used: "no" };

    dataOf(await call(setStatus, "PATCH", { session, params, body: { status: "closed" } }));
    expect(dataOf(await call<PublicSurvey>(getPublicSurvey, "GET", { params })).status).toBe("closed");
    expectError(await respond(surveyId, { versionId, answers, mode: "complete" }), 409, "SURVEY_CLOSED");

    dataOf(await call(setStatus, "PATCH", { session, params, body: { status: "published" } }));
    expect((await respond(surveyId, { versionId, answers, mode: "complete" })).status).toBe(201);
  });

  it("can't close a survey that was never published", async () => {
    const session = await signUp();
    const { id: surveyId } = dataOf(await call<SurveyDetail>(createSurvey, "POST", { session, body: {} }));
    const res = await call(setStatus, "PATCH", { session, params: { surveyId }, body: { status: "closed" } });
    expectError(res, 409, "NOT_PUBLISHED");
  });

  it("deletes a survey, which takes its public link down", async () => {
    const session = await signUp();
    const { surveyId } = await publishedSurvey(session);
    const params = { surveyId };

    expect(dataOf(await call(deleteSurvey, "DELETE", { session, params }))).toEqual({ id: surveyId });
    expectError(await call(getSurvey, "GET", { session, params }), 404, "NOT_FOUND");
    expectError(await call(getPublicSurvey, "GET", { params }), 404, "NOT_FOUND");
  });
});
