import { describe, expect, it } from "vitest";
import { feedbackSurvey } from "../../test/fixtures/survey";
import { evaluateCondition, getVisibleQuestionIds, isAnswered, readAnswer } from "./logic";

const visible = (answers: Record<string, unknown>) =>
  [...getVisibleQuestionIds(feedbackSurvey.questions, answers)];

describe("isAnswered", () => {
  it("treats empty values as unanswered", () => {
    for (const empty of [undefined, null, "", "   ", []]) expect(isAnswered(empty)).toBe(false);
    for (const value of ["a", 0, 3, ["x"]]) expect(isAnswered(value)).toBe(true);
  });
});

describe("readAnswer", () => {
  it("ignores inherited object properties", () => {
    expect(readAnswer({}, "constructor")).toBeUndefined();
    expect(readAnswer({ constructor: "own" }, "constructor")).toBe("own");
  });
});

describe("evaluateCondition", () => {
  it("handles equality operators", () => {
    expect(evaluateCondition({ questionId: "q", operator: "equals", value: "yes" }, "yes")).toBe(true);
    expect(evaluateCondition({ questionId: "q", operator: "equals", value: "yes" }, "no")).toBe(false);
    expect(evaluateCondition({ questionId: "q", operator: "not_equals", value: "yes" }, "no")).toBe(true);
  });

  it("handles includes operators for multi choice answers", () => {
    const answer = ["a", "b"];
    expect(evaluateCondition({ questionId: "q", operator: "includes", value: "a" }, answer)).toBe(true);
    expect(evaluateCondition({ questionId: "q", operator: "includes", value: "c" }, answer)).toBe(false);
    expect(evaluateCondition({ questionId: "q", operator: "not_includes", value: "c" }, answer)).toBe(true);
  });

  it("handles numeric comparisons for ratings", () => {
    expect(evaluateCondition({ questionId: "q", operator: "gte", value: 4 }, 4)).toBe(true);
    expect(evaluateCondition({ questionId: "q", operator: "gte", value: 4 }, 3)).toBe(false);
    expect(evaluateCondition({ questionId: "q", operator: "lte", value: 2 }, 2)).toBe(true);
    expect(evaluateCondition({ questionId: "q", operator: "lte", value: 2 }, 5)).toBe(false);
  });

  it("never matches an unanswered source, even for negative operators", () => {
    expect(evaluateCondition({ questionId: "q", operator: "not_equals", value: "yes" }, undefined)).toBe(false);
    expect(evaluateCondition({ questionId: "q", operator: "not_includes", value: "a" }, [])).toBe(false);
  });

  it("does not match values of the wrong type", () => {
    expect(evaluateCondition({ questionId: "q", operator: "gte", value: 3 }, "5")).toBe(false);
    expect(evaluateCondition({ questionId: "q", operator: "includes", value: "a" }, "a")).toBe(false);
  });
});

describe("getVisibleQuestionIds", () => {
  it("shows only unconditional questions before anything is answered", () => {
    expect(visible({})).toEqual(["q_used", "q_features", "q_comments"]);
  });

  it("reveals a question when its condition is met", () => {
    expect(visible({ q_used: "yes" })).toContain("q_rating");
  });

  it("follows a chain of conditions", () => {
    expect(visible({ q_used: "yes", q_rating: 1 })).toContain("q_improve");
    expect(visible({ q_used: "yes", q_rating: 4 })).not.toContain("q_improve");
  });

  it("hides dependents of a hidden question, ignoring its stale answer", () => {
    // The respondent rated 1, then switched q_used to "no": q_rating hides, so q_improve must hide too.
    const ids = visible({ q_used: "no", q_rating: 1 });
    expect(ids).not.toContain("q_rating");
    expect(ids).not.toContain("q_improve");
  });
});
