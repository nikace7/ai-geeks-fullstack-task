"use client";

import { useId, type ReactNode } from "react";
import { cx, fieldClasses } from "@/components/ui/cx";
import {
  OPERATORS_BY_SOURCE_TYPE,
  RATING_MAX,
  RATING_MIN,
  type Condition,
} from "@/core/survey-schema";
import { OPERATOR_LABELS, describeCondition } from "./changes";
import { conditionSources, defaultCondition, isChoice } from "./draft-ops";
import type { QuestionEditorProps } from "./question-editor";

const RATINGS = Array.from({ length: RATING_MAX - RATING_MIN + 1 }, (_, i) => RATING_MIN + i);

type VisibilityEditorProps = Pick<QuestionEditorProps, "question" | "index" | "questions" | "issues" | "onChange">;

/** "Always show" or "Only if <earlier question> <operator> <answer>", built from choices so it's always valid. */
export function VisibilityEditor({ question, index, questions, issues, onChange }: VisibilityEditorProps) {
  const id = `q-${question.id}`;
  const sources = conditionSources(questions, index);
  const condition = question.showIf;
  const source = sources.find((q) => q.id === condition?.questionId);
  const isBroken = Object.keys(issues).some((path) => path.startsWith("showIf"));
  const summary = condition && !isBroken ? describeCondition(condition, questions) : null;

  // undefined disappears when the draft is sent as JSON, which removes the condition.
  const setCondition = (showIf: Condition | undefined) => onChange((q) => ({ ...q, showIf }));

  return (
    <section aria-labelledby={`${id}-visibility`} className="flex flex-col gap-3.5 rounded-xl border border-zinc-200 bg-white p-5">
      <div className="flex flex-col gap-0.5">
        <h2 id={`${id}-visibility`} className="text-sm font-semibold">
          Visibility
        </h2>
        <p className="text-xs text-zinc-500">Show this question to everyone, or only after a certain answer.</p>
      </div>

      <div role="radiogroup" aria-labelledby={`${id}-visibility`} className="flex flex-wrap gap-2">
        <RadioCard name={`${id}-visibility`} checked={!condition} onChange={() => setCondition(undefined)}>
          Always show
        </RadioCard>
        <RadioCard
          name={`${id}-visibility`}
          checked={Boolean(condition)}
          disabled={!condition && sources.length === 0}
          onChange={() => setCondition(defaultCondition(sources[sources.length - 1]))}
        >
          Only if an earlier answer matches
        </RadioCard>
      </div>

      {!condition && sources.length === 0 && (
        <p className="text-xs text-zinc-500">
          Conditions can only use a choice or rating question above this one, so the form always flows top to bottom.
        </p>
      )}

      {condition && (
        <div className="flex animate-reveal flex-col gap-4 rounded-[10px] border border-zinc-200 bg-zinc-50 p-4">
          <div className="flex flex-col gap-1.5">
            <label htmlFor={`${id}-source`} className="text-xs font-medium text-zinc-600">
              When the answer to
            </label>
            <select
              id={`${id}-source`}
              value={source?.id ?? ""}
              aria-invalid={isBroken}
              onChange={(e) => {
                const next = sources.find((q) => q.id === e.target.value);
                if (next) setCondition(defaultCondition(next));
              }}
              className={cx(fieldClasses, "h-10")}
            >
              {!source && (
                <option value="" disabled>
                  Choose a question
                </option>
              )}
              {sources.map((q) => (
                <option key={q.id} value={q.id}>
                  Q{questions.indexOf(q) + 1} · {q.title}
                </option>
              ))}
            </select>
          </div>

          {source && (
            <>
              <ChipGroup
                label="Matches when it"
                options={OPERATORS_BY_SOURCE_TYPE[source.type].map((op) => ({ value: op, label: OPERATOR_LABELS[op] }))}
                selected={condition.operator}
                onSelect={(operator) => setCondition({ ...condition, operator })}
              />
              <ChipGroup
                label="This answer"
                options={
                  isChoice(source)
                    ? source.options.map((o): ChipOption => ({ value: o.id, label: o.label.trim() || "Untitled option" }))
                    : RATINGS.map((n): ChipOption => ({ value: n, label: String(n) }))
                }
                selected={condition.value}
                onSelect={(value) => setCondition({ ...condition, value })}
              />
            </>
          )}

          {isBroken && (
            <p role="alert" className="text-xs text-red-700">
              This condition no longer matches its question. Pick the question and answer again.
            </p>
          )}
          {summary && (
            <p className="text-[13px] text-blue-900">
              Shown only when the answer to Q{summary.question} {summary.operator} “{summary.value}”. Otherwise it’s
              skipped, and any answer to it is dropped.
            </p>
          )}
        </div>
      )}
    </section>
  );
}

function RadioCard({
  name,
  checked,
  disabled,
  onChange,
  children,
}: {
  name: string;
  checked: boolean;
  disabled?: boolean;
  onChange: () => void;
  children: ReactNode;
}) {
  return (
    <label
      className={cx(
        "inline-flex h-10 items-center gap-2 rounded-lg border px-3 transition-colors",
        checked ? "border-blue-300 bg-blue-50" : "border-zinc-200 bg-white",
        disabled ? "cursor-not-allowed opacity-45" : "cursor-pointer hover:border-zinc-300",
      )}
    >
      <input type="radio" name={name} checked={checked} disabled={disabled} onChange={onChange} className="accent-blue-600" />
      {children}
    </label>
  );
}

type ChipOption<T = Condition["value"]> = { value: T; label: string };

function ChipGroup<T extends Condition["value"]>({
  label,
  options,
  selected,
  onSelect,
}: {
  label: string;
  options: ChipOption<T>[];
  selected: string | number;
  onSelect: (value: T) => void;
}) {
  const labelId = useId();
  return (
    <div role="group" aria-labelledby={labelId} className="flex flex-col gap-1.5">
      <span id={labelId} className="text-xs font-medium text-zinc-600">
        {label}
      </span>
      <div className="flex flex-wrap gap-1.5">
        {options.map((option) => (
          <button
            key={option.value}
            type="button"
            aria-pressed={option.value === selected}
            onClick={() => onSelect(option.value)}
            className="h-8 rounded-full border border-zinc-200 bg-white px-3 text-[13px] font-medium text-zinc-700 transition-colors hover:border-zinc-300 aria-pressed:border-blue-300 aria-pressed:bg-blue-50 aria-pressed:text-blue-700"
          >
            {option.label}
          </button>
        ))}
      </div>
    </div>
  );
}
