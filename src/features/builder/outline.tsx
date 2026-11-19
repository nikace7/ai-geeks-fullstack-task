"use client";

import { useState } from "react";
import { cx, fieldClasses } from "@/components/ui/cx";
import { FieldError } from "@/components/ui/field";
import { BranchIcon, GripIcon, PlusIcon } from "@/components/ui/icons";
import { LIMITS, type QuestionType, type SurveyDefinition } from "@/core/survey-schema";
import { describeCondition } from "./changes";
import { moveQuestion } from "./draft-ops";
import { QuestionTypePicker, TYPE_META, questionIssues } from "./question-types";

interface OutlineProps {
  survey: SurveyDefinition;
  issues: Readonly<Record<string, string>>;
  selectedId: string | null;
  onSelect: (id: string) => void;
  onDetailsChange: (details: Partial<Pick<SurveyDefinition, "title" | "description">>) => void;
  onMove: (from: number, to: number) => void;
  onAdd: (type: QuestionType) => void;
}

/** Left column: survey title and description, the question list (select, drag to reorder) and Add question. */
export function Outline({ survey, issues, selectedId, onSelect, onDetailsChange, onMove, onAdd }: OutlineProps) {
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [drag, setDrag] = useState<{ from: number; over: number | null } | null>(null);
  const { questions } = survey;

  return (
    <aside
      aria-label="Survey outline"
      className="flex flex-col gap-6 border-b border-zinc-200 bg-white px-4 py-5 md:sticky md:top-14 md:h-[calc(100dvh-3.5rem)] md:overflow-y-auto md:[scrollbar-gutter:stable] md:border-b-0 md:border-r"
    >
      <section className="flex flex-col gap-1.5">
        <label htmlFor="survey-title" className="text-xs font-medium text-zinc-600">
          Survey title
        </label>
        <input
          id="survey-title"
          value={survey.title}
          onChange={(e) => onDetailsChange({ title: e.target.value })}
          maxLength={LIMITS.surveyTitle}
          aria-invalid={Boolean(issues.title)}
          aria-describedby={issues.title ? "survey-title-error" : undefined}
          className={cx(fieldClasses, "h-9")}
        />
        {issues.title && <FieldError id="survey-title-error">{issues.title}</FieldError>}
        <label htmlFor="survey-description" className="mt-2 text-xs font-medium text-zinc-600">
          Description <span className="font-normal text-zinc-500">· optional</span>
        </label>
        <textarea
          id="survey-description"
          rows={3}
          value={survey.description}
          onChange={(e) => onDetailsChange({ description: e.target.value })}
          maxLength={LIMITS.surveyDescription}
          placeholder="What is this survey for? Respondents see this under the title."
          className={cx(fieldClasses, "resize-y py-2")}
        />
      </section>

      <section aria-labelledby="outline-heading" className="flex flex-col gap-2">
        <div className="flex items-baseline justify-between gap-2">
          <h2 id="outline-heading" className="text-xs font-medium text-zinc-600">
            Questions <span className="font-mono text-zinc-500">{questions.length}</span>
          </h2>
          {questions.length > 1 && <span className="text-xs text-zinc-500 pointer-coarse:hidden">Drag to reorder</span>}
        </div>

        <ol className="flex flex-col gap-0.5">
          {questions.map((question, i) => {
            const { Icon } = TYPE_META[question.type];
            const isSelected = question.id === selectedId;
            const condition = question.showIf && describeCondition(question.showIf, questions);
            const ownIssues = Object.entries(questionIssues(issues, i));
            const issue = ownIssues.find(([path]) => path.startsWith("showIf"))
              ? "Its condition needs fixing"
              : ownIssues[0]?.[1];
            const isDropTarget = drag !== null && drag.over === i && drag.from !== i;

            return (
              <li
                key={question.id}
                draggable
                onDragStart={(e) => {
                  e.dataTransfer.effectAllowed = "move";
                  e.dataTransfer.setData("text/plain", question.id); // Firefox won't start a drag without data
                  setDrag({ from: i, over: null });
                }}
                onDragOver={(e) => {
                  // Only accept drops that keep every condition pointing at an earlier question.
                  if (!drag || drag.from === i || !moveQuestion(questions, drag.from, i)) return;
                  e.preventDefault();
                  if (drag.over !== i) setDrag({ ...drag, over: i });
                }}
                onDrop={(e) => {
                  e.preventDefault();
                  if (drag) onMove(drag.from, i);
                  setDrag(null);
                }}
                onDragEnd={() => setDrag(null)}
                className={cx(
                  "relative flex items-start gap-0.5 rounded-lg p-1 transition-colors",
                  isSelected ? "bg-blue-50 ring-1 ring-inset ring-blue-200" : "hover:bg-zinc-100",
                  drag?.from === i && "opacity-50",
                )}
              >
                {isDropTarget && (
                  <span
                    aria-hidden="true"
                    className={cx("absolute inset-x-1 h-0.5 rounded-full bg-blue-600", drag.from > i ? "-top-px" : "-bottom-px")}
                  />
                )}
                <span aria-hidden="true" title="Drag to reorder" className="flex cursor-grab px-0.5 py-2 text-zinc-400">
                  <GripIcon size={14} />
                </span>
                <button
                  type="button"
                  onClick={() => onSelect(question.id)}
                  aria-current={isSelected ? "true" : undefined}
                  className="flex min-w-0 grow flex-col gap-1 rounded-md px-1 py-1.5 text-left"
                >
                  <span className="flex w-full min-w-0 items-center gap-2">
                    <span className="w-[22px] shrink-0 font-mono text-xs text-zinc-500">Q{i + 1}</span>
                    <Icon size={14} className="shrink-0 text-zinc-600" />
                    <span className="truncate">{question.title.trim() || "Untitled question"}</span>
                    {question.required && (
                      <>
                        <span aria-hidden="true" className="text-red-600">*</span>
                        <span className="sr-only">(required)</span>
                      </>
                    )}
                  </span>
                  {condition && (
                    <span className="ml-[30px] inline-flex items-center gap-1 self-start rounded-full bg-blue-50 px-1.5 py-px text-xs text-blue-700">
                      <BranchIcon size={12} />
                      Only if Q{condition.question} {condition.operator} {condition.value}
                    </span>
                  )}
                  {issue && <span className="ml-[30px] text-xs text-red-700">{issue}</span>}
                </button>
              </li>
            );
          })}
        </ol>

        <button
          type="button"
          onClick={() => setIsAddOpen((open) => !open)}
          aria-expanded={isAddOpen}
          aria-controls="add-question-menu"
          disabled={questions.length >= LIMITS.questions}
          className="inline-flex h-9 items-center gap-2 self-start rounded-lg px-2 font-medium text-zinc-700 hover:bg-zinc-100 disabled:opacity-45"
        >
          <PlusIcon />
          Add question
        </button>
        {isAddOpen && (
          <div
            id="add-question-menu"
            // The outline scrolls on its own, so bring the menu into view when it opens below the fold.
            ref={(menu) => menu?.scrollIntoView({ block: "nearest", behavior: "smooth" })}
            className="animate-reveal rounded-[10px] border border-zinc-200 bg-white p-1 shadow-sm"
          >
            <QuestionTypePicker
              onPick={(type) => {
                onAdd(type);
                setIsAddOpen(false);
              }}
            />
          </div>
        )}
      </section>
    </aside>
  );
}
