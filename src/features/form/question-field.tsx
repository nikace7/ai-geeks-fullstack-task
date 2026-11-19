"use client";

import { FieldError } from "@/components/ui/field";
import { cx } from "@/components/ui/cx";
import { LIMITS, RATING_MAX, RATING_MIN, type AnswerValue, type Question } from "@/core/survey-schema";
import { formatNumber } from "@/lib/format";

interface QuestionFieldProps {
  question: Question;
  value: AnswerValue | undefined;
  onChange: (value: AnswerValue) => void;
  error?: string;
  /** Keeps element ids unique when the same question renders twice on a page (builder preview). */
  idPrefix: string;
}

const RATINGS = Array.from({ length: RATING_MAX - RATING_MIN + 1 }, (_, i) => RATING_MIN + i);

const HINTS: Partial<Record<Question["type"], string>> = {
  single_choice: "Select one",
  multi_choice: "Select all that apply",
};

/**
 * One question as respondents see it, used by the public form and the builder's live preview so the
 * two can't drift apart. Native radios and checkboxes give keyboard support (arrow keys, space) for free.
 */
export function QuestionField({ question, value, onChange, error, idPrefix }: QuestionFieldProps) {
  const id = `${idPrefix}-${question.id}`;
  const hint = HINTS[question.type];
  const isRadioGroup = question.type === "single_choice" || question.type === "rating";
  const describedBy = [hint && `${id}-hint`, error && `${id}-error`].filter(Boolean).join(" ") || undefined;

  return (
    // A labelled group rather than fieldset/legend: legends don't take part in flex layout.
    <div
      role={isRadioGroup ? "radiogroup" : "group"}
      aria-labelledby={`${id}-title`}
      aria-describedby={describedBy}
      aria-required={question.type !== "text" && question.required ? true : undefined}
      // Radios can't carry aria-invalid themselves; their radiogroup can.
      aria-invalid={isRadioGroup && error ? true : undefined}
      className="flex min-w-0 flex-col gap-3"
    >
      <div className="flex flex-col gap-0.5">
        <p id={`${id}-title`} className="text-lg font-medium leading-7 text-zinc-900">
          {question.title}
          {question.required && (
            <>
              <span aria-hidden="true" className="text-red-600"> *</span>
              <span className="sr-only"> (required)</span>
            </>
          )}
        </p>
        {hint && (
          <p id={`${id}-hint`} className="text-[13px] text-zinc-500">
            {hint}
          </p>
        )}
      </div>

      {question.type === "text" && (
        <TextAnswer
          id={id}
          value={typeof value === "string" ? value : ""}
          onChange={onChange}
          isInvalid={Boolean(error)}
          isRequired={question.required}
        />
      )}

      {(question.type === "single_choice" || question.type === "multi_choice") && (
        <div className="flex flex-col gap-2">
          {question.options.map((option) => {
            const selected = Array.isArray(value) ? value : [];
            const isMulti = question.type === "multi_choice";
            const isChecked = isMulti ? selected.includes(option.id) : value === option.id;
            return (
              <label
                key={option.id}
                className="flex min-h-[52px] cursor-pointer items-center gap-3 rounded-[10px] border border-zinc-200 px-4 py-3 text-[15px] transition-colors hover:border-zinc-400 has-checked:border-blue-600 has-checked:bg-blue-50/60"
              >
                <input
                  type={isMulti ? "checkbox" : "radio"}
                  name={id}
                  checked={isChecked}
                  aria-invalid={isMulti && Boolean(error) ? true : undefined}
                  onChange={(e) =>
                    onChange(
                      isMulti
                        ? // Rebuilt from the option list, so answers keep the survey's order however they were clicked.
                          question.options
                            .filter((o) => (o.id === option.id ? e.target.checked : selected.includes(o.id)))
                            .map((o) => o.id)
                        : option.id,
                    )
                  }
                  className="size-[18px] shrink-0 accent-blue-600"
                />
                {option.label}
              </label>
            );
          })}
        </div>
      )}

      {question.type === "rating" && (
        <div className="flex max-w-[420px] flex-col gap-2">
          <div className="grid grid-cols-5 gap-2">
            {RATINGS.map((n) => (
              <label key={n} className="relative">
                <input
                  type="radio"
                  name={id}
                  checked={value === n}
                  onChange={() => onChange(n)}
                  className="peer sr-only"
                />
                <span
                  className={cx(
                    "grid h-[52px] cursor-pointer place-items-center rounded-[10px] border border-zinc-200 text-[17px] font-medium transition-colors",
                    "hover:border-zinc-400 peer-checked:border-blue-600 peer-checked:bg-blue-600 peer-checked:text-white",
                    "peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-blue-600",
                  )}
                >
                  {n}
                  <span className="sr-only">{n === RATING_MIN ? ", poor" : n === RATING_MAX ? ", excellent" : ""}</span>
                </span>
              </label>
            ))}
          </div>
          <div aria-hidden="true" className="flex justify-between text-[13px] text-zinc-500">
            <span>Poor</span>
            <span>Excellent</span>
          </div>
        </div>
      )}

      {error && <FieldError id={`${id}-error`}>{error}</FieldError>}
    </div>
  );
}

function TextAnswer({
  id,
  value,
  onChange,
  isInvalid,
  isRequired,
}: {
  id: string;
  value: string;
  onChange: (value: string) => void;
  isInvalid: boolean;
  isRequired: boolean;
}) {
  return (
    <div className="flex flex-col gap-1">
      <textarea
        aria-labelledby={`${id}-title`}
        aria-invalid={isInvalid}
        aria-required={isRequired}
        rows={4}
        maxLength={LIMITS.textAnswer}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="Type your answer"
        className="w-full resize-y rounded-[10px] border border-zinc-200 bg-white px-3.5 py-3 text-[15px] leading-6 transition-colors placeholder:text-zinc-400 hover:border-zinc-300 focus-visible:border-blue-600 focus-visible:outline-offset-0 aria-invalid:border-red-600"
      />
      <span className="self-end font-mono text-xs text-zinc-500">
        {formatNumber(value.length)} / {formatNumber(LIMITS.textAnswer)}
      </span>
    </div>
  );
}
