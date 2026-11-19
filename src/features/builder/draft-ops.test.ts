import { describe, expect, it } from "vitest";
import { surveyDefinitionSchema } from "@/core/survey-schema";
import { cloneSurvey } from "../../../test/fixtures/survey";
import {
  changeType,
  conditionSources,
  createQuestion,
  defaultCondition,
  dependentsOf,
  insertQuestion,
  moveQuestion,
  removeQuestion,
} from "./draft-ops";

const ids = (questions: { id: string }[]) => questions.map((q) => q.id);

describe("createQuestion", () => {
  it.each(["text", "single_choice", "multi_choice", "rating"] as const)("creates a valid %s question", (type) => {
    const survey = { ...cloneSurvey(), questions: [createQuestion(type)] };
    expect(surveyDefinitionSchema.safeParse(survey).success).toBe(true);
  });

  it("gives every question and option a fresh id", () => {
    const [a, b] = [createQuestion("single_choice"), createQuestion("single_choice")];
    expect(a.id).not.toBe(b.id);
    expect(a.type === "single_choice" && b.type === "single_choice" && a.options[0].id).not.toBe(
      b.type === "single_choice" && b.options[0].id,
    );
  });
});

describe("changeType", () => {
  const [used, rating] = cloneSurvey().questions;

  it("keeps the options when switching between choice types", () => {
    const multi = changeType(used, "multi_choice");
    expect(multi).toMatchObject({ id: used.id, title: used.title, type: "multi_choice" });
    expect(multi.type === "multi_choice" && multi.options).toEqual(used.type === "single_choice" && used.options);
  });

  it("adds two starter options when switching to a choice type", () => {
    const choice = changeType(rating, "single_choice");
    expect(choice.type === "single_choice" && choice.options).toHaveLength(2);
    expect(choice.showIf).toEqual(rating.showIf);
  });

  it("drops options when switching to text or rating", () => {
    expect(changeType(used, "text")).not.toHaveProperty("options");
  });
});

describe("moveQuestion", () => {
  const { questions } = cloneSurvey();

  it("moves a question and returns a new array", () => {
    const moved = moveQuestion(questions, 4, 3);
    expect(ids(moved!)).toEqual(["q_used", "q_rating", "q_improve", "q_comments", "q_features"]);
    expect(ids(questions)).toEqual(["q_used", "q_rating", "q_improve", "q_features", "q_comments"]);
  });

  it("refuses to move a question above the question its condition depends on", () => {
    expect(moveQuestion(questions, 1, 0)).toBeNull();
    expect(moveQuestion(questions, 2, 0)).toBeNull();
  });

  it("refuses to move a question below a question that depends on it", () => {
    expect(moveQuestion(questions, 0, 1)).toBeNull();
    expect(moveQuestion(questions, 1, 3)).toBeNull();
  });

  it("ignores conditions whose source no longer exists", () => {
    const orphan = questions.map((q) =>
      q.id === "q_comments" ? { ...q, showIf: { questionId: "gone", operator: "equals" as const, value: "x" } } : q,
    );
    expect(moveQuestion(orphan, 4, 0)).not.toBeNull();
  });

  it("rejects out-of-range positions", () => {
    expect(moveQuestion(questions, 0, -1)).toBeNull();
    expect(moveQuestion(questions, 4, 5)).toBeNull();
  });
});

describe("insertQuestion and removeQuestion", () => {
  it("restores a removed question at its old position", () => {
    const { questions } = cloneSurvey();
    const removed = removeQuestion(questions, "q_features");
    expect(ids(removed)).not.toContain("q_features");
    expect(insertQuestion(removed, questions[3], 3)).toEqual(questions);
  });
});

describe("conditions", () => {
  const { questions } = cloneSurvey();

  it("lists the questions whose condition depends on a question", () => {
    expect(ids(dependentsOf(questions, "q_used"))).toEqual(["q_rating"]);
    expect(dependentsOf(questions, "q_features")).toEqual([]);
  });

  it("offers only earlier, non-text questions as condition sources", () => {
    expect(ids(conditionSources(questions, 4))).toEqual(["q_used", "q_rating", "q_features"]);
    expect(conditionSources(questions, 0)).toEqual([]);
  });

  it("builds a valid default condition for each source type", () => {
    expect(defaultCondition(questions[0])).toEqual({ questionId: "q_used", operator: "equals", value: "yes" });
    expect(defaultCondition(questions[1])).toEqual({ questionId: "q_rating", operator: "equals", value: 3 });
    expect(defaultCondition(questions[3])).toEqual({ questionId: "q_features", operator: "includes", value: "f_reports" });
  });
});
