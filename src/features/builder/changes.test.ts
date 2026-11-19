import { describe, expect, it } from "vitest";
import { cloneSurvey } from "../../../test/fixtures/survey";
import { describeCondition, diffSurveys, isSameJson } from "./changes";

describe("isSameJson", () => {
  it("ignores key order and keys set to undefined, like a JSON round trip", () => {
    expect(isSameJson({ a: 1, b: [1, { c: 2 }] }, { b: [1, { c: 2 }], a: 1, d: undefined })).toBe(true);
    expect(isSameJson({ a: [1, 2] }, { a: [2, 1] })).toBe(false);
    expect(isSameJson({ a: 1 }, { a: "1" })).toBe(false);
    expect(isSameJson([], {})).toBe(false);
  });
});

describe("describeCondition", () => {
  const { questions } = cloneSurvey();

  it("names the source by its number and the answer by its label", () => {
    expect(describeCondition(questions[1].showIf!, questions)).toEqual({ question: 1, operator: "is", value: "Yes" });
    expect(describeCondition(questions[2].showIf!, questions)).toEqual({ question: 2, operator: "is at most", value: "2" });
  });

  it("returns null when the condition no longer points at a real answer", () => {
    expect(describeCondition({ questionId: "gone", operator: "equals", value: "yes" }, questions)).toBeNull();
    expect(describeCondition({ questionId: "q_used", operator: "equals", value: "maybe" }, questions)).toBeNull();
  });
});

describe("diffSurveys", () => {
  it("reports nothing for identical surveys", () => {
    expect(diffSurveys(cloneSurvey(), cloneSurvey())).toEqual([]);
  });

  it("reports added, edited, removed and reordered questions", () => {
    const before = cloneSurvey();
    const after = cloneSurvey();
    after.title = "Product feedback";
    const [used, rating, improve, features] = after.questions;
    after.questions = [
      used,
      { ...rating, title: "How would you rate us?", required: false },
      improve,
      { id: "q_new", type: "text", title: "Your role?", required: false },
      { ...features, showIf: { questionId: "q_used", operator: "equals", value: "yes" } },
    ];
    after.questions.splice(1, 0, after.questions.splice(4, 1)[0]); // move features up

    expect(diffSurveys(before, after)).toEqual([
      { kind: "Edited", label: "Survey title", detail: "was “Customer feedback”" },
      { kind: "Edited", label: "Q2 · Which features do you use?", detail: "now shown only sometimes" },
      { kind: "Edited", label: "Q3 · How would you rate us?", detail: "new wording, now optional" },
      { kind: "Added", label: "Q5 · Your role?" },
      { kind: "Removed", label: "Anything else?" },
      { kind: "Moved", label: "Question order changed" },
    ]);
  });
});
