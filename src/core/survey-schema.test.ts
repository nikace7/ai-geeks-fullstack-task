import { describe, expect, it } from "vitest";
import { cloneSurvey, feedbackSurvey } from "../../test/fixtures/survey";
import { surveyDefinitionSchema } from "./survey-schema";

/** Parses a survey and returns the error messages keyed by their path, e.g. "questions.1.showIf.questionId". */
function issuesOf(input: unknown): Record<string, string> {
  const result = surveyDefinitionSchema.safeParse(input);
  if (result.success) return {};
  return Object.fromEntries(result.error.issues.map((i) => [i.path.join("."), i.message]));
}

describe("surveyDefinitionSchema", () => {
  it("accepts a valid survey with every question type and chained conditions", () => {
    expect(surveyDefinitionSchema.safeParse(feedbackSurvey).success).toBe(true);
  });

  it("trims titles and labels", () => {
    const survey = cloneSurvey();
    survey.title = "  Padded  ";
    const parsed = surveyDefinitionSchema.parse(survey);
    expect(parsed.title).toBe("Padded");
  });

  it("requires a survey title and question titles", () => {
    const survey = cloneSurvey();
    survey.title = "   ";
    survey.questions[4].title = "";
    expect(issuesOf(survey)).toMatchObject({
      title: "Survey title is required",
      "questions.4.title": "Question text is required",
    });
  });

  it("requires at least two options on choice questions", () => {
    const survey = cloneSurvey();
    const q = survey.questions[3];
    if (q.type !== "multi_choice") throw new Error("fixture changed");
    q.options = [q.options[0]];
    expect(issuesOf(survey)).toMatchObject({ "questions.3.options": "Add at least two options" });
  });

  it("rejects duplicate question ids and duplicate option ids", () => {
    const survey = cloneSurvey();
    survey.questions[4].id = "q_used";
    const q = survey.questions[3];
    if (q.type !== "multi_choice") throw new Error("fixture changed");
    q.options[1].id = q.options[0].id;
    expect(issuesOf(survey)).toMatchObject({
      "questions.4.id": "Duplicate question id",
      "questions.3.options.1.id": "Duplicate option id",
    });
  });

  describe("conditions", () => {
    it("rejects a condition on a later question (prevents cycles)", () => {
      const survey = cloneSurvey();
      survey.questions[0].showIf = { questionId: "q_rating", operator: "equals", value: 3 };
      expect(issuesOf(survey)).toMatchObject({
        "questions.0.showIf.questionId": "A condition can only depend on an earlier question",
      });
    });

    it("rejects a condition on the question itself", () => {
      const survey = cloneSurvey();
      survey.questions[1].showIf = { questionId: "q_rating", operator: "equals", value: 3 };
      expect(issuesOf(survey)).toMatchObject({
        "questions.1.showIf.questionId": "A condition can only depend on an earlier question",
      });
    });

    it("rejects a condition on a question that does not exist", () => {
      const survey = cloneSurvey();
      survey.questions[1].showIf = { questionId: "q_missing", operator: "equals", value: "yes" };
      expect(issuesOf(survey)).toMatchObject({
        "questions.1.showIf.questionId": "This condition refers to a question that no longer exists",
      });
    });

    it("rejects an operator that does not fit the source question type", () => {
      const survey = cloneSurvey();
      survey.questions[1].showIf = { questionId: "q_used", operator: "gte", value: "yes" };
      expect(issuesOf(survey)).toMatchObject({
        "questions.1.showIf.operator": "This operator doesn't apply to that question type",
      });
    });

    it("rejects text questions as a condition source", () => {
      const survey = cloneSurvey();
      survey.questions[4].showIf = { questionId: "q_improve", operator: "equals", value: "x" };
      expect(issuesOf(survey)).toMatchObject({
        "questions.4.showIf.operator": "This operator doesn't apply to that question type",
      });
    });

    it("rejects a choice condition whose value is not one of the source options", () => {
      const survey = cloneSurvey();
      survey.questions[1].showIf = { questionId: "q_used", operator: "equals", value: "maybe" };
      expect(issuesOf(survey)).toMatchObject({
        "questions.1.showIf.value": "Pick one of the source question's options",
      });
    });

    it("rejects a rating condition value outside 1–5", () => {
      const survey = cloneSurvey();
      survey.questions[2].showIf = { questionId: "q_rating", operator: "lte", value: 9 };
      expect(issuesOf(survey)).toMatchObject({
        "questions.2.showIf.value": "Pick a rating from 1 to 5",
      });
    });
  });
});
