import {
  OPERATORS_BY_SOURCE_TYPE,
  type ChoiceQuestion,
  type Condition,
  type Question,
  type QuestionOption,
  type QuestionType,
} from "@/core/survey-schema";

/**
 * Pure, immutable edits to a survey's question list. The builder UI only ever calls these, so every
 * rule about what an edit may do (e.g. "a question can't move above the question it depends on")
 * lives here, where it is unit-tested, instead of being scattered through components.
 */

// 8 hex chars: unique within one survey by a wide margin, and short enough to read in the JSON.
const shortId = () => crypto.randomUUID().slice(0, 8);

export const isChoice = (question: Question): question is ChoiceQuestion =>
  question.type === "single_choice" || question.type === "multi_choice";

export const newOption = (label: string): QuestionOption => ({ id: `o_${shortId()}`, label });

/** Starts with a placeholder title so the draft stays valid (and keeps autosaving) the moment it's added. */
export const createQuestion = (type: QuestionType): Question =>
  changeType({ id: `q_${shortId()}`, type: "text", title: "Untitled question", required: false }, type);

/** Keeps id, wording, required and visibility. Options carry over between the two choice types. */
export function changeType(question: Question, type: QuestionType): Question {
  const { id, title, required, showIf } = question;
  const base = { id, title, required, ...(showIf && { showIf }) };
  if (type === "single_choice" || type === "multi_choice") {
    const options = isChoice(question) ? question.options : [newOption("Option 1"), newOption("Option 2")];
    return { ...base, type, options };
  }
  return { ...base, type };
}

export const insertQuestion = (questions: readonly Question[], question: Question, index: number): Question[] =>
  questions.toSpliced(index, 0, question);

export const removeQuestion = (questions: readonly Question[], id: string): Question[] =>
  questions.filter((q) => q.id !== id);

/**
 * Moves the question at `from` to `to`, or returns null if that would put a question above the
 * question its condition reads. Conditions may only look backwards, so the form can always be
 * evaluated top to bottom. Conditions pointing at a deleted question don't block anything.
 */
export function moveQuestion(questions: readonly Question[], from: number, to: number): Question[] | null {
  if (to < 0 || to >= questions.length || from === to) return null;
  const moved = questions.toSpliced(from, 1).toSpliced(to, 0, questions[from]);
  const existing = new Set(moved.map((q) => q.id));
  const seen = new Set<string>();
  for (const question of moved) {
    const source = question.showIf?.questionId;
    if (source && existing.has(source) && !seen.has(source)) return null;
    seen.add(question.id);
  }
  return moved;
}

/** Questions whose condition reads this question's answer. */
export const dependentsOf = (questions: readonly Question[], id: string): Question[] =>
  questions.filter((q) => q.showIf?.questionId === id);

/** A condition can read any earlier choice or rating question. Text answers are too free-form to match on. */
export const conditionSources = (questions: readonly Question[], index: number): Question[] =>
  questions.slice(0, index).filter((q) => q.type !== "text");

/** A ready-to-use condition on `source`, so switching to "Only if…" never starts in an invalid state. */
export function defaultCondition(source: Question): Condition {
  const operator = OPERATORS_BY_SOURCE_TYPE[source.type][0];
  const value = isChoice(source) ? source.options[0].id : 3;
  return { questionId: source.id, operator, value };
}
