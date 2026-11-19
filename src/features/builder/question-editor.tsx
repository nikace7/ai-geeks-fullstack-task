"use client";

import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { cx, fieldClasses } from "@/components/ui/cx";
import { FieldError } from "@/components/ui/field";
import { ArrowDownIcon, ArrowUpIcon, PlusIcon, TrashIcon, XIcon } from "@/components/ui/icons";
import { LIMITS, type ChoiceQuestion, type Question, type QuestionType } from "@/core/survey-schema";
import { changeType, dependentsOf, isChoice, moveQuestion, newOption } from "./draft-ops";
import { VisibilityEditor } from "./visibility-editor";

export interface QuestionEditorProps {
  question: Question;
  index: number;
  questions: readonly Question[];
  /** This question's validation messages, keyed like "title" or "options.1.label". */
  issues: Readonly<Record<string, string>>;
  /** Just added: focus and select the placeholder title so typing replaces it. */
  isNew: boolean;
  onChange: (change: (question: Question) => Question) => void;
  onMove: (to: number) => void;
  onDelete: () => void;
}

const listFormat = new Intl.ListFormat("en", { type: "conjunction" });

export function QuestionEditor({ question, index, questions, issues, isNew, onChange, onMove, onDelete }: QuestionEditorProps) {
  const id = `q-${question.id}`;
  const titleRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!isNew) return;
    titleRef.current?.focus();
    titleRef.current?.select();
  }, [isNew]);

  const previous = questions[index - 1];
  const dependents = dependentsOf(questions, question.id).map((q) => `Q${questions.indexOf(q) + 1}`);
  const isUpBlocked = previous !== undefined && question.showIf?.questionId === previous.id;

  return (
    <div className="flex w-full max-w-[640px] flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-base font-semibold">
          Question {index + 1} <span className="font-normal text-zinc-500">of {questions.length}</span>
        </h1>
        <div className="flex gap-0.5">
          <Button variant="ghost" size="icon" aria-label="Move question up" disabled={!moveQuestion(questions, index, index - 1)} onClick={() => onMove(index - 1)}>
            <ArrowUpIcon />
          </Button>
          <Button variant="ghost" size="icon" aria-label="Move question down" disabled={!moveQuestion(questions, index, index + 1)} onClick={() => onMove(index + 1)}>
            <ArrowDownIcon />
          </Button>
          <Button variant="ghost" size="icon" aria-label="Delete question" disabled={dependents.length > 0} onClick={onDelete}>
            <TrashIcon />
          </Button>
        </div>
      </div>

      {(isUpBlocked || dependents.length > 0) && (
        <p className="-mt-2 text-xs text-zinc-500">
          {isUpBlocked && `Depends on Q${index}’s answer, so it can’t move above Q${index}. `}
          {dependents.length > 0 &&
            `${listFormat.format(dependents)} ${dependents.length === 1 ? "depends" : "depend"} on this answer, so it can’t be deleted or moved below ${dependents[0]} until that condition changes.`}
        </p>
      )}

      <section aria-label="Question" className="flex flex-col gap-4 rounded-xl border border-zinc-200 bg-white p-5">
        <div className="flex flex-col gap-1.5">
          <label htmlFor={`${id}-title`} className="text-xs font-medium text-zinc-600">
            Question
          </label>
          <input
            ref={titleRef}
            id={`${id}-title`}
            value={question.title}
            onChange={(e) => onChange((q) => ({ ...q, title: e.target.value }))}
            placeholder="What do you want to ask?"
            maxLength={LIMITS.questionTitle}
            aria-invalid={Boolean(issues.title)}
            aria-describedby={issues.title ? `${id}-title-error` : undefined}
            className={cx(fieldClasses, "h-10 text-[15px]")}
          />
          {issues.title && <FieldError id={`${id}-title-error`}>{issues.title}</FieldError>}
        </div>

        <div className="flex flex-col gap-1.5">
          <label htmlFor={`${id}-type`} className="text-xs font-medium text-zinc-600">
            Answer type
          </label>
          <select
            id={`${id}-type`}
            value={question.type}
            onChange={(e) => onChange((q) => changeType(q, e.target.value as QuestionType))}
            className={cx(fieldClasses, "h-10")}
          >
            <option value="text">Text input</option>
            <option value="single_choice">Multiple choice (pick one)</option>
            <option value="multi_choice">Checkboxes (pick any)</option>
            <option value="rating">Rating (1–5)</option>
          </select>
        </div>

        {isChoice(question) && <OptionsEditor question={question} issues={issues} onChange={onChange} />}
        {question.type === "rating" && <RatingScale />}
        {question.type === "text" && (
          <p className="text-xs text-zinc-500">
            Respondents get a multi-line answer box (up to 5,000 characters). Text answers can’t drive conditions.
          </p>
        )}

        <div className="flex items-center justify-between gap-4 border-t border-zinc-100 pt-4">
          <div className="flex flex-col gap-0.5">
            <span id={`${id}-required`} className="font-medium">
              Required
            </span>
            <span id={`${id}-required-hint`} className="text-xs text-zinc-500">
              Respondents must answer before submitting. A hidden question is never required.
            </span>
          </div>
          <button
            type="button"
            role="switch"
            aria-checked={question.required}
            aria-labelledby={`${id}-required`}
            aria-describedby={`${id}-required-hint`}
            onClick={() => onChange((q) => ({ ...q, required: !q.required }))}
            className="group relative h-6 w-10 shrink-0 rounded-full bg-zinc-300 transition-colors aria-checked:bg-blue-600"
          >
            <span
              aria-hidden="true"
              className="absolute left-[3px] top-[3px] size-[18px] rounded-full bg-white shadow-sm transition-transform group-aria-checked:translate-x-4"
            />
          </button>
        </div>
      </section>

      <VisibilityEditor question={question} index={index} questions={questions} issues={issues} onChange={onChange} />
    </div>
  );
}

function OptionsEditor({
  question,
  issues,
  onChange,
}: {
  question: ChoiceQuestion;
  issues: Readonly<Record<string, string>>;
  onChange: QuestionEditorProps["onChange"];
}) {
  // The option to focus when it mounts: set when one is added, so typing continues in the new box.
  const [focusId, setFocusId] = useState<string | null>(null);
  const { options } = question;
  const isFull = options.length >= LIMITS.options;

  const setOptions = (update: (options: ChoiceQuestion["options"]) => ChoiceQuestion["options"]) =>
    onChange((q) => (isChoice(q) ? { ...q, options: update(q.options) } : q));

  const addAfter = (index: number) => {
    const option = newOption(`Option ${options.length + 1}`);
    setOptions((current) => current.toSpliced(index + 1, 0, option));
    setFocusId(option.id);
  };

  return (
    <fieldset className="flex flex-col gap-2">
      <legend className="mb-1.5 text-xs font-medium text-zinc-600">Options</legend>
      {options.map((option, j) => {
        const errorId = `${option.id}-error`;
        const error = issues[`options.${j}.label`];
        return (
          <div key={option.id} className="flex flex-col gap-1">
            <div className="flex items-center gap-2">
              <span
                aria-hidden="true"
                className={cx(
                  "size-3.5 shrink-0 border-[1.5px] border-zinc-400",
                  question.type === "multi_choice" ? "rounded" : "rounded-full",
                )}
              />
              <input
                autoFocus={option.id === focusId}
                aria-label={`Option ${j + 1}`}
                value={option.label}
                onChange={(e) =>
                  setOptions((current) => current.map((o) => (o.id === option.id ? { ...o, label: e.target.value } : o)))
                }
                onKeyDown={(e) => {
                  if (e.key !== "Enter") return;
                  e.preventDefault();
                  if (!isFull) addAfter(j);
                }}
                maxLength={LIMITS.optionLabel}
                aria-invalid={Boolean(error)}
                aria-describedby={error ? errorId : undefined}
                className={cx(fieldClasses, "h-9")}
              />
              <Button
                variant="ghost"
                size="icon"
                aria-label={`Remove option ${j + 1}`}
                disabled={options.length <= 2}
                onClick={() => setOptions((current) => current.filter((o) => o.id !== option.id))}
              >
                <XIcon size={14} />
              </Button>
            </div>
            {error && (
              <div className="ml-[22px]">
                <FieldError id={errorId}>{error}</FieldError>
              </div>
            )}
          </div>
        );
      })}
      <div className="flex flex-wrap items-center gap-3">
        <Button variant="ghost" size="sm" icon={<PlusIcon size={14} />} disabled={isFull} onClick={() => addAfter(options.length - 1)}>
          Add option
        </Button>
        <span className="text-xs text-zinc-500">At least 2 options, up to {LIMITS.options}. Enter adds the next one.</span>
      </div>
    </fieldset>
  );
}

function RatingScale() {
  return (
    <div className="flex flex-col gap-2">
      <span className="text-xs font-medium text-zinc-600">Scale</span>
      <div aria-hidden="true" className="grid max-w-[320px] grid-cols-5 gap-1.5">
        {[1, 2, 3, 4, 5].map((n) => (
          <span key={n} className="grid h-9 place-items-center rounded-lg border border-zinc-200 font-medium text-zinc-600">
            {n}
          </span>
        ))}
      </div>
      <span className="text-xs text-zinc-500">
        Fixed at 1 (poor) to 5 (excellent), so averages stay comparable between versions.
      </span>
    </div>
  );
}
