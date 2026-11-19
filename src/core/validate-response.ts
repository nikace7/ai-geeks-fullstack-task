import { isAnswered, isQuestionShown, readAnswer } from "./logic";
import {
  LIMITS,
  RATING_MAX,
  RATING_MIN,
  type AnswerValue,
  type Answers,
  type Question,
  type SurveyDefinition,
} from "./survey-schema";

/** "partial" is for autosave: types are checked, but required questions may still be empty. */
export type ResponseMode = "complete" | "partial";

export type ResponseValidationResult =
  | { success: true; answers: Answers }
  | { success: false; errors: Record<string, string> };

type ParsedAnswer = { ok: true; value: AnswerValue } | { ok: false; error: string };

const ok = (value: AnswerValue): ParsedAnswer => ({ ok: true, value });
const fail = (error: string): ParsedAnswer => ({ ok: false, error });

/**
 * Validates a respondent's answers against a survey and returns a cleaned copy.
 *
 * The browser runs this for instant feedback and the server runs it again before saving,
 * because anything sent from a browser can be tampered with. Answers to hidden or unknown
 * questions are dropped, so the stored data always matches what the respondent was shown.
 */
export function validateResponse(
  survey: Pick<SurveyDefinition, "questions">,
  input: Readonly<Record<string, unknown>>,
  mode: ResponseMode,
): ResponseValidationResult {
  // Conditions are evaluated against answers that already passed validation (sources always come
  // earlier), so an invalid answer such as a rating of 0 can never reveal a follow-up question.
  const visibleIds = new Set<string>();
  const validAnswers = new Map<string, AnswerValue>();
  const errors = new Map<string, string>();

  for (const question of survey.questions) {
    if (!isQuestionShown(question, visibleIds, (id) => validAnswers.get(id))) continue;
    visibleIds.add(question.id);

    const raw = readAnswer(input, question.id);
    if (!isAnswered(raw)) {
      if (question.required && mode === "complete") errors.set(question.id, "This question is required");
      continue;
    }

    const parsed = parseAnswer(question, raw);
    if (parsed.ok) validAnswers.set(question.id, parsed.value);
    else errors.set(question.id, parsed.error);
  }

  // Object.fromEntries defines own properties, so an id like "__proto__" stays a plain key.
  return errors.size > 0
    ? { success: false, errors: Object.fromEntries(errors) }
    : { success: true, answers: Object.fromEntries(validAnswers) };
}

function parseAnswer(question: Question, raw: unknown): ParsedAnswer {
  switch (question.type) {
    case "text": {
      if (typeof raw !== "string") return fail("Expected a text answer");
      const text = raw.trim();
      return text.length <= LIMITS.textAnswer ? ok(text) : fail(`Answer must be at most ${LIMITS.textAnswer} characters`);
    }

    case "single_choice":
      return typeof raw === "string" && question.options.some((o) => o.id === raw)
        ? ok(raw)
        : fail("Choose one of the listed options");

    case "multi_choice": {
      if (!Array.isArray(raw)) return fail("Choose only from the listed options");
      const selected = new Set<unknown>(raw);
      // Keep the survey's option order and drop duplicates, so stored answers are canonical.
      const optionIds = question.options.filter((o) => selected.has(o.id)).map((o) => o.id);
      return optionIds.length === selected.size ? ok(optionIds) : fail("Choose only from the listed options");
    }

    case "rating":
      return typeof raw === "number" && Number.isInteger(raw) && raw >= RATING_MIN && raw <= RATING_MAX
        ? ok(raw)
        : fail(`Rating must be a whole number from ${RATING_MIN} to ${RATING_MAX}`);
  }
}
