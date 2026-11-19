"use client";

import { useState } from "react";
import { cx } from "@/components/ui/cx";
import { BranchIcon, EyeIcon, RetryIcon } from "@/components/ui/icons";
import { Button } from "@/components/ui/button";
import { getVisibleQuestionIds } from "@/core/logic";
import type { AnswerValue, SurveyDefinition } from "@/core/survey-schema";
import { QuestionField } from "@/features/form/question-field";
import { describeCondition } from "./changes";

interface LivePreviewProps {
  survey: SurveyDefinition;
  selectedId: string | null;
  onSelect: (id: string) => void;
  className?: string;
}

/**
 * The form as respondents will see it, rendered by the same QuestionField the public form uses.
 * It's interactive: answering a question here shows or skips the questions that depend on it,
 * so conditions can be tried out before publishing.
 */
export function LivePreview({ survey, selectedId, onSelect, className }: LivePreviewProps) {
  // Keyed by id and type, so changing a question's type drops a test answer that no longer fits it.
  const [answers, setAnswers] = useState<Record<string, AnswerValue>>({});
  const { questions } = survey;
  const keyOf = (q: (typeof questions)[number]) => `${q.id}:${q.type}`;
  const answersById = Object.fromEntries(
    questions.flatMap((q) => (Object.hasOwn(answers, keyOf(q)) ? [[q.id, answers[keyOf(q)]]] : [])),
  );
  const visible = getVisibleQuestionIds(questions, answersById);
  const hasAnswers = Object.keys(answersById).length > 0;

  return (
    <aside
      aria-labelledby="preview-heading"
      className={cx(
        "flex flex-col gap-4 border-t border-zinc-200 bg-zinc-100/60 px-4 py-5 lg:sticky lg:top-14 lg:h-[calc(100dvh-3.5rem)] lg:overflow-y-auto lg:[scrollbar-gutter:stable] lg:border-l lg:border-t-0",
        className,
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <div className="flex flex-col">
          <h2 id="preview-heading" className="inline-flex items-center gap-1.5 text-xs font-medium text-zinc-600">
            <EyeIcon size={14} />
            Live preview
          </h2>
          <span className="text-xs text-zinc-500">What respondents see. Try the answers.</span>
        </div>
        {hasAnswers && (
          <Button variant="ghost" size="sm" icon={<RetryIcon size={14} />} onClick={() => setAnswers({})}>
            Clear answers
          </Button>
        )}
      </div>

      <div className="flex flex-col gap-1 rounded-xl border border-zinc-200 bg-white p-5">
        <p className="text-lg font-semibold tracking-tight">{survey.title.trim() || "Untitled survey"}</p>
        {survey.description && <p className="whitespace-pre-line text-zinc-600">{survey.description}</p>}
      </div>

      {questions.length === 0 && <p className="text-center text-xs text-zinc-500">Questions show up here as you add them.</p>}

      {questions.map((question, i) => {
        const condition = question.showIf && describeCondition(question.showIf, questions);
        const rule = condition && `Q${condition.question} ${condition.operator} “${condition.value}”`;
        const isSelected = question.id === selectedId;

        if (!visible.has(question.id)) {
          return (
            <button
              key={question.id}
              type="button"
              onClick={() => onSelect(question.id)}
              className={cx(
                "flex items-center gap-2 rounded-xl border border-dashed px-4 py-3 text-left text-xs text-zinc-500 transition-colors hover:bg-white",
                isSelected ? "border-blue-300" : "border-zinc-300",
              )}
            >
              <BranchIcon size={14} className="shrink-0" />
              <span>
                <span className="font-mono">Q{i + 1}</span> skipped{rule ? `: shown only if ${rule}` : ""}
              </span>
            </button>
          );
        }

        return (
          // Clicking the card selects the question for editing; the inputs inside still work normally.
          <div
            key={question.id}
            onClickCapture={() => onSelect(question.id)}
            className={cx(
              "flex flex-col gap-3 rounded-xl border bg-white p-5 transition-shadow",
              isSelected ? "border-blue-300 ring-2 ring-blue-100" : "border-zinc-200",
            )}
          >
            {rule && (
              <span className="inline-flex items-center gap-1 self-start rounded-full bg-blue-50 px-2 py-0.5 text-xs text-blue-700">
                <BranchIcon size={12} />
                Shown because {rule}
              </span>
            )}
            <QuestionField
              question={{ ...question, title: question.title.trim() || "Untitled question" }}
              value={answers[keyOf(question)]}
              onChange={(value) => setAnswers((current) => ({ ...current, [keyOf(question)]: value }))}
              idPrefix="preview"
            />
          </div>
        );
      })}

      <p className="text-xs text-zinc-500">
        Edits save as you type. Respondents keep seeing the published version until you press Publish changes.
      </p>
    </aside>
  );
}
