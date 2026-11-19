"use client";

import { useState } from "react";
import { useToast } from "@/components/ui/toast";
import { surveyDefinitionSchema, type Question, type QuestionType } from "@/core/survey-schema";
import { toFieldErrors } from "@/lib/api-contract";
import type { PublishedVersion, SurveyDetail } from "@/server/surveys/service";
import { BuilderHeader } from "./builder-header";
import { isSameJson } from "./changes";
import { createQuestion, insertQuestion, moveQuestion, removeQuestion } from "./draft-ops";
import { LivePreview } from "./live-preview";
import { Outline } from "./outline";
import { PublishDialog, type LiveState } from "./publish-dialog";
import { QuestionEditor } from "./question-editor";
import { QuestionTypePicker, questionIssues } from "./question-types";
import { useAutosave } from "./use-autosave";

/**
 * Owns the draft and everything derived from it. The draft is validated with the same schema the
 * server uses, so the issues shown here are exactly the ones that would block a save or a publish.
 */
export function SurveyBuilder({ survey }: { survey: SurveyDetail }) {
  const toast = useToast();
  const [draft, setDraft] = useState(survey.draft);
  const [selectedId, setSelectedId] = useState(survey.draft.questions[0]?.id ?? null);
  // The question just added, so its editor focuses the title. Cleared on the next selection.
  const [addedId, setAddedId] = useState<string | null>(null);
  const [live, setLive] = useState<LiveState>({
    status: survey.status,
    version: survey.latestVersion,
    definition: survey.published,
    inProgressCount: survey.inProgressCount,
  });
  const [announcement, setAnnouncement] = useState("");
  const [isPublishing, setIsPublishing] = useState(false);

  const parsed = surveyDefinitionSchema.safeParse(draft);
  const issues = parsed.success ? {} : toFieldErrors(parsed.error);
  const issueCount = Object.keys(issues).length;
  const autosave = useAutosave(survey.id, draft, parsed.success);

  const { questions } = draft;
  const selectedIndex = Math.max(0, questions.findIndex((q) => q.id === selectedId));
  const selected = questions[selectedIndex];
  const hasUnpublishedChanges = live.definition === null || !isSameJson(parsed.data ?? draft, live.definition);

  const publishBlockedBy =
    issueCount > 0
      ? "Fix the highlighted issues to publish"
      : questions.length === 0
        ? "Add a question before publishing"
        : !hasUnpublishedChanges
          ? `No changes since v${live.version}`
          : null;

  const setQuestions = (update: (questions: Question[]) => Question[]) =>
    setDraft((current) => ({ ...current, questions: update(current.questions) }));

  function select(id: string) {
    setSelectedId(id);
    setAddedId(null);
  }

  function handleAdd(type: QuestionType) {
    const question = createQuestion(type);
    setQuestions((current) => [...current, question]);
    setSelectedId(question.id);
    setAddedId(question.id);
  }

  function handleMove(from: number, to: number) {
    const moved = moveQuestion(questions, from, to);
    if (!moved) return;
    setDraft({ ...draft, questions: moved });
    setAnnouncement(`Moved question ${from + 1} to position ${to + 1} of ${questions.length}`);
  }

  function handleDelete(index: number) {
    const removed = questions[index];
    const neighbour = questions[index + 1] ?? questions[index - 1];
    setQuestions((current) => removeQuestion(current, removed.id));
    setSelectedId(neighbour?.id ?? null);
    toast({
      message: `Deleted Q${index + 1}`,
      action: {
        label: "Undo",
        onClick: () => {
          setQuestions((current) => insertQuestion(current, removed, Math.min(index, current.length)));
          select(removed.id);
        },
      },
    });
  }

  function showFirstIssue() {
    const [path] = Object.keys(issues);
    const match = /^questions\.(\d+)\./.exec(path ?? "");
    const question = match && questions[Number(match[1])];
    if (!question) {
      document.getElementById("survey-title")?.focus();
      return;
    }
    select(question.id);
    // Wait for the selected question's editor to render, then focus its first invalid field.
    requestAnimationFrame(() => document.querySelector<HTMLElement>('#question-editor [aria-invalid="true"]')?.focus());
  }

  function handlePublished(published: PublishedVersion) {
    setLive((current) => ({
      status: "published",
      version: published.version,
      definition: parsed.data ?? null,
      // Same version means nothing changed (a closed survey reopened); a new one starts with nobody partway.
      inProgressCount: published.version === current.version ? current.inProgressCount : 0,
    }));
  }

  return (
    <>
      <BuilderHeader
        title={draft.title.trim() || "Untitled survey"}
        status={live.status}
        version={live.version}
        hasUnpublishedChanges={hasUnpublishedChanges}
        save={autosave}
        issueCount={issueCount}
        onShowIssue={showFirstIssue}
        publishBlockedBy={publishBlockedBy}
        onPublish={() => setIsPublishing(true)}
      />
      <div className="grid grid-cols-[minmax(0,1fr)] md:grid-cols-[280px_minmax(0,1fr)] lg:grid-cols-[280px_minmax(0,1fr)_320px] xl:grid-cols-[300px_minmax(0,1fr)_360px]">
        <Outline
          survey={draft}
          issues={issues}
          selectedId={selected?.id ?? null}
          onSelect={select}
          onDetailsChange={(details) => setDraft((current) => ({ ...current, ...details }))}
          onMove={handleMove}
          onAdd={handleAdd}
        />
        <main id="question-editor" className="flex justify-center px-4 py-6 sm:px-8">
          {selected ? (
            <QuestionEditor
              // A fresh editor per question, so local state (like which option to focus) never leaks between them.
              key={selected.id}
              question={selected}
              index={selectedIndex}
              questions={questions}
              issues={questionIssues(issues, selectedIndex)}
              isNew={selected.id === addedId}
              onChange={(change) => setQuestions((current) => current.map((q) => (q.id === selected.id ? change(q) : q)))}
              onMove={(to) => handleMove(selectedIndex, to)}
              onDelete={() => handleDelete(selectedIndex)}
            />
          ) : (
            <EmptyBuilder onAdd={handleAdd} />
          )}
        </main>
        <LivePreview survey={draft} selectedId={selected?.id ?? null} onSelect={select} className="md:col-span-2 lg:col-span-1" />
      </div>
      <p role="status" className="sr-only">
        {announcement}
      </p>
      {isPublishing && parsed.success && (
        <PublishDialog
          surveyId={survey.id}
          live={live}
          draft={parsed.data}
          flush={autosave.flush}
          onClose={() => setIsPublishing(false)}
          onPublished={handlePublished}
        />
      )}
    </>
  );
}

function EmptyBuilder({ onAdd }: { onAdd: (type: QuestionType) => void }) {
  return (
    <div className="flex w-full max-w-[640px] flex-col gap-4 self-start rounded-xl border border-dashed border-zinc-300 bg-white p-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-base font-semibold">Add your first question</h1>
        <p className="text-zinc-600">Pick an answer type. You can change it, reorder questions and add conditions later.</p>
      </div>
      <QuestionTypePicker onPick={onAdd} className="sm:grid-cols-2" />
    </div>
  );
}
