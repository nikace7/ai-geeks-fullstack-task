import type { Condition, ConditionOperator, Question, SurveyDefinition } from "@/core/survey-schema";
import { isChoice } from "./draft-ops";

/** How each operator reads in a sentence: "Q1 is Yes", "Q2 is at most 2". */
export const OPERATOR_LABELS: Record<ConditionOperator, string> = {
  equals: "is",
  not_equals: "is not",
  includes: "includes",
  not_includes: "doesn’t include",
  gte: "is at least",
  lte: "is at most",
};

/**
 * Deep equality for JSON data. Postgres jsonb doesn't keep key order and JSON drops undefined
 * values, so a plain JSON.stringify comparison would report false differences.
 */
export function isSameJson(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (typeof a !== "object" || typeof b !== "object" || a === null || b === null) return false;
  if (Array.isArray(a) !== Array.isArray(b)) return false;
  const keys = (o: object) => Object.entries(o).filter(([, v]) => v !== undefined);
  const [entriesA, entriesB] = [keys(a), keys(b)];
  const lookupB = new Map(entriesB);
  return entriesA.length === entriesB.length && entriesA.every(([k, v]) => lookupB.has(k) && isSameJson(v, lookupB.get(k)));
}

/** The parts of a condition as respondents' answers would show them, or null if it no longer points at a real answer. */
export function describeCondition(
  condition: Condition,
  questions: readonly Question[],
): { question: number; operator: string; value: string } | null {
  const index = questions.findIndex((q) => q.id === condition.questionId);
  const source = questions[index];
  if (!source || source.type === "text") return null;
  const value = isChoice(source)
    ? source.options.find((o) => o.id === condition.value)?.label
    : typeof condition.value === "number" ? String(condition.value) : undefined;
  return value === undefined ? null : { question: index + 1, operator: OPERATOR_LABELS[condition.operator], value };
}

export interface Change {
  kind: "Added" | "Edited" | "Removed" | "Moved";
  label: string;
  detail?: string;
}

/** What publishing `after` changes for respondents compared with the live `before`, in reading order. */
export function diffSurveys(before: SurveyDefinition, after: SurveyDefinition): Change[] {
  const changes: Change[] = [];
  if (before.title !== after.title) changes.push({ kind: "Edited", label: "Survey title", detail: `was “${before.title}”` });
  if (before.description !== after.description) changes.push({ kind: "Edited", label: "Survey description" });

  const beforeById = new Map(before.questions.map((q) => [q.id, q]));
  after.questions.forEach((question, i) => {
    const label = `Q${i + 1} · ${question.title}`;
    const old = beforeById.get(question.id);
    if (!old) return changes.push({ kind: "Added", label });
    const edits = describeEdits(old, question);
    if (edits.length > 0) changes.push({ kind: "Edited", label, detail: edits.join(", ") });
  });

  const afterIds = new Set(after.questions.map((q) => q.id));
  for (const question of before.questions) {
    if (!afterIds.has(question.id)) changes.push({ kind: "Removed", label: question.title });
  }

  // Compare the order of the questions both versions share, so adds and removes alone don't count as a move.
  const keptBefore = before.questions.filter((q) => afterIds.has(q.id));
  const keptAfter = after.questions.filter((q) => beforeById.has(q.id));
  if (keptBefore.some((q, i) => q.id !== keptAfter[i].id)) changes.push({ kind: "Moved", label: "Question order changed" });

  return changes;
}

function describeEdits(before: Question, after: Question): string[] {
  const edits: string[] = [];
  if (before.title !== after.title) edits.push("new wording");
  if (before.type !== after.type) edits.push("new answer type");
  else if (isChoice(before) && isChoice(after) && !isSameJson(before.options, after.options)) edits.push("options changed");
  if (before.required !== after.required) edits.push(after.required ? "now required" : "now optional");
  if (!isSameJson(before.showIf, after.showIf)) {
    edits.push(!after.showIf ? "now always shown" : before.showIf ? "new visibility rule" : "now shown only sometimes");
  }
  return edits;
}
