import type { Condition, Question } from "./survey-schema";

/** Empty strings, whitespace, empty selections and missing values all count as "not answered". */
export function isAnswered(value: unknown): boolean {
  if (value === undefined || value === null) return false;
  if (typeof value === "string") return value.trim().length > 0;
  if (Array.isArray(value)) return value.length > 0;
  return true;
}

/**
 * An unanswered source never satisfies a condition, including `not_equals`.
 * Otherwise "show B if A ≠ Yes" would show B before the respondent has even looked at A.
 */
export function evaluateCondition(condition: Condition, answer: unknown): boolean {
  if (!isAnswered(answer)) return false;
  const { operator, value } = condition;
  switch (operator) {
    case "equals":
      return answer === value;
    case "not_equals":
      return answer !== value;
    case "includes":
      return Array.isArray(answer) && answer.includes(value);
    case "not_includes":
      return Array.isArray(answer) && !answer.includes(value);
    case "gte":
      return typeof answer === "number" && typeof value === "number" && answer >= value;
    case "lte":
      return typeof answer === "number" && typeof value === "number" && answer <= value;
  }
}

/**
 * Returns the ids of the questions the respondent should see, in survey order.
 *
 * Conditions may only point to earlier questions (enforced by the schema), so one
 * top-to-bottom pass is enough: by the time we reach a question, its source's
 * visibility is already known. A question whose source is hidden is hidden too,
 * which ignores stale answers left behind when the respondent changes their mind.
 */
export function getVisibleQuestionIds(
  questions: readonly Question[],
  answers: Readonly<Record<string, unknown>>,
): Set<string> {
  const visible = new Set<string>();
  for (const question of questions) {
    if (isQuestionShown(question, visible, (id) => readAnswer(answers, id))) visible.add(question.id);
  }
  return visible;
}

/**
 * The single visibility rule, shared by the form (raw answers) and the validator (validated answers):
 * a question is shown if it has no condition, or its source is shown and the condition holds.
 */
export function isQuestionShown(
  question: Question,
  visibleIds: ReadonlySet<string>,
  answerOf: (questionId: string) => unknown,
): boolean {
  const condition = question.showIf;
  if (!condition) return true;
  return visibleIds.has(condition.questionId) && evaluateCondition(condition, answerOf(condition.questionId));
}

/** Reads only the object's own keys, so an id like "constructor" can't pick up inherited properties. */
export function readAnswer(answers: Readonly<Record<string, unknown>>, questionId: string): unknown {
  return Object.hasOwn(answers, questionId) ? answers[questionId] : undefined;
}
