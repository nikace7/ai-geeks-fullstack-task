import { describe, expect, it } from "vitest";
import { feedbackSurvey } from "../../test/fixtures/survey";
import { validateResponse } from "./validate-response";

const complete = (answers: Record<string, unknown>) => validateResponse(feedbackSurvey, answers, "complete");
const partial = (answers: Record<string, unknown>) => validateResponse(feedbackSurvey, answers, "partial");

describe("validateResponse", () => {
  it("accepts a complete response and returns cleaned answers", () => {
    const result = complete({
      q_used: "yes",
      q_rating: 2,
      q_improve: "  Faster exports  ",
      q_features: ["f_api", "f_reports", "f_api"],
    });
    expect(result).toEqual({
      success: true,
      answers: {
        q_used: "yes",
        q_rating: 2,
        q_improve: "Faster exports", // trimmed
        q_features: ["f_reports", "f_api"], // de-duplicated, in option order
      },
    });
  });

  it("requires visible required questions", () => {
    expect(complete({ q_used: "yes" })).toEqual({
      success: false,
      errors: { q_rating: "This question is required" },
    });
  });

  it("does not require hidden questions", () => {
    expect(complete({ q_used: "no" })).toEqual({ success: true, answers: { q_used: "no" } });
  });

  it("drops answers to hidden questions and unknown question ids", () => {
    const result = complete({ q_used: "no", q_rating: 1, q_improve: "stale", q_hacker: "x" });
    expect(result).toEqual({ success: true, answers: { q_used: "no" } });
  });

  it("treats whitespace-only text and empty selections as unanswered", () => {
    const result = complete({ q_used: "yes", q_rating: 5, q_comments: "   ", q_features: [] });
    expect(result).toEqual({ success: true, answers: { q_used: "yes", q_rating: 5 } });
  });

  it("rejects values that are not valid for the question type", () => {
    const result = complete({
      q_used: "maybe",
      q_features: ["f_reports", "f_unknown"],
      q_comments: 42,
    });
    expect(result).toEqual({
      success: false,
      errors: {
        q_used: "Choose one of the listed options",
        q_features: "Choose only from the listed options",
        q_comments: "Expected a text answer",
      },
    });
  });

  it.each([0, 6, 2.5, "3"])("rejects rating %j", (rating) => {
    const result = complete({ q_used: "yes", q_rating: rating });
    expect(result).toEqual({
      success: false,
      errors: { q_rating: "Rating must be a whole number from 1 to 5" },
    });
  });

  it("never lets an invalid answer reveal follow-up questions", () => {
    // 0 would satisfy "rating <= 2", but it's invalid, so q_improve must stay hidden (and not required).
    const result = complete({ q_used: "yes", q_rating: 0, q_improve: "should be ignored" });
    expect(result).toEqual({
      success: false,
      errors: { q_rating: "Rating must be a whole number from 1 to 5" },
    });
  });

  it("limits text answer length", () => {
    const result = complete({ q_used: "no", q_comments: "x".repeat(5001) });
    expect(result).toEqual({
      success: false,
      errors: { q_comments: "Answer must be at most 5000 characters" },
    });
  });

  describe("partial mode (autosave)", () => {
    it("skips required checks", () => {
      expect(partial({})).toEqual({ success: true, answers: {} });
    });

    it("still rejects invalid values", () => {
      expect(partial({ q_used: "maybe" })).toEqual({
        success: false,
        errors: { q_used: "Choose one of the listed options" },
      });
    });
  });
});
