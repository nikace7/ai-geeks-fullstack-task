"use client";

import { useCallback, useRef, type FormEvent, type ReactNode, type Ref } from "react";
import { Button } from "@/components/ui/button";
import { cx } from "@/components/ui/cx";
import { FormError } from "@/components/ui/field";
import { AlertIcon, CheckIcon, HistoryIcon, OfflineIcon, RetryIcon, SpinnerIcon } from "@/components/ui/icons";
import { useToast } from "@/components/ui/toast";
import { useAction } from "@/components/ui/use-action";
import { getVisibleQuestionIds, isAnswered } from "@/core/logic";
import { formatDate } from "@/lib/format";
import { FormEndState, SurveyClosed, SurveyNotFound } from "./form-end-state";
import { QuestionField } from "./question-field";
import { useSurveyResponse, type FormPhase, type SaveStatus, type SurveyVersion } from "./use-survey-response";

/** Reads only own keys, so a question id like "constructor" can't pick up an inherited property. */
const own = <T,>(record: Record<string, T>, key: string): T | undefined => (Object.hasOwn(record, key) ? record[key] : undefined);

/** The public form. Questions appear and disappear as answers change, and progress saves as you go. */
export function SurveyForm({ surveyId, live }: { surveyId: string; live: SurveyVersion }) {
  const honeypotRef = useRef<HTMLInputElement>(null);
  const response = useSurveyResponse(surveyId, live, honeypotRef);
  const toast = useToast();
  const submitAction = useAction(response.submit);
  // When a message replaces the form, focus moves to it, so keyboard and screen reader users land there.
  const focusHeading = useCallback((heading: HTMLHeadingElement | null) => heading?.focus(), []);
  const { definition, answers, errors, phase } = response;

  if (phase.kind !== "answering") {
    return (
      <EndScreen phase={phase} title={definition.title} headingRef={focusHeading} onRespondAgain={response.startNewResponse} />
    );
  }

  const visible = getVisibleQuestionIds(definition.questions, answers);
  const questions = definition.questions.filter((q) => visible.has(q.id));
  const answered = questions.filter((q) => isAnswered(own(answers, q.id))).length;
  const toFix = questions.filter((q) => own(errors, q.id)).length;
  const isLocked = response.isRestoring || response.restoreError !== null;
  const submitError = submitAction.error?.code === "VALIDATION_FAILED" ? null : submitAction.error?.message;

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const result = await submitAction.run();
    const fields = result?.success === false ? result.error.details?.fields : undefined;
    const first = fields && questions.find((q) => own(fields, q.id));
    if (first) focusQuestion(first.id);
  }

  function handleStartOver() {
    const cleared = response.startOver();
    toast({ message: "Answers cleared.", action: { label: "Undo", onClick: () => response.setAnswers(cleared) } });
  }

  return (
    <>
      <div
        role="progressbar"
        aria-label="Survey progress"
        aria-valuemin={0}
        aria-valuemax={questions.length}
        aria-valuenow={answered}
        aria-valuetext={`${answered} of ${questions.length} answered`}
        className="fixed inset-x-0 top-0 z-10 h-1 bg-zinc-100"
      >
        <div
          className="h-full origin-left bg-blue-600 transition-transform duration-300 ease-out"
          style={{ transform: `scaleX(${questions.length ? answered / questions.length : 0})` }}
        />
      </div>

      <main className="mx-auto flex max-w-[680px] flex-col gap-10 px-6 pb-24 pt-12">
        <div className="flex min-h-5 flex-wrap items-center justify-between gap-x-4 gap-y-1 text-[13px] text-zinc-500">
          <span className="tabular-nums">
            {answered} of {questions.length} answered
          </span>
          <SaveIndicator status={response.isRestoring ? "restoring" : response.saveStatus} />
        </div>

        {response.restoredFrom && (
          <Notice icon={<HistoryIcon size={16} />} action={<Button size="sm" onClick={handleStartOver}>Start over</Button>}>
            Welcome back. We restored the answers you started on {formatDate(response.restoredFrom)}.
          </Notice>
        )}
        {response.restoreError && (
          <Notice
            tone="error"
            icon={<AlertIcon size={16} />}
            action={
              <Button size="sm" icon={<RetryIcon size={14} />} onClick={response.retryRestore}>
                Try again
              </Button>
            }
          >
            We couldn’t load the answers you saved earlier. {response.restoreError}
          </Notice>
        )}

        <header className="flex flex-col gap-3">
          <h1 className="text-balance text-[30px] font-semibold leading-[38px] tracking-tight">{definition.title}</h1>
          {definition.description && (
            <p className="whitespace-pre-line text-base leading-[26px] text-zinc-600">{definition.description}</p>
          )}
          {/* A key for the asterisks; each required question also says "required" to screen readers. */}
          {definition.questions.some((q) => q.required) && (
            <p aria-hidden="true" className="text-[13px] text-zinc-500">
              <span className="text-red-600">*</span> Required
            </p>
          )}
        </header>

        <form noValidate onSubmit={handleSubmit} className="flex flex-col gap-9">
          <fieldset disabled={isLocked} className="flex min-w-0 flex-col gap-9 transition-opacity disabled:opacity-60">
            {questions.map((question) => (
              <div key={question.id} id={`question-${question.id}`} className="animate-reveal scroll-mt-8">
                <QuestionField
                  question={question}
                  value={own(answers, question.id)}
                  onChange={(value) => response.setAnswer(question.id, value)}
                  error={own(errors, question.id)}
                  idPrefix="form"
                />
              </div>
            ))}
          </fieldset>

          {/* Honeypot: off-screen and out of the tab order, so only bots fill it in. */}
          <div aria-hidden="true" className="absolute -left-[9999px] size-px overflow-hidden">
            <label>
              Website
              <input ref={honeypotRef} name="website" type="text" tabIndex={-1} autoComplete="off" />
            </label>
          </div>

          {toFix > 0 && (
            <FormError>
              {toFix === 1 ? "1 question needs" : `${toFix} questions need`} an answer before you can submit.
            </FormError>
          )}
          {submitError && <FormError>{submitError}</FormError>}

          <div className="flex flex-wrap items-center gap-x-5 gap-y-3">
            <Button
              type="submit"
              variant="primary"
              size="xl"
              status={submitAction.status}
              pendingLabel="Submitting…"
              disabled={isLocked}
              className="min-w-[160px]"
            >
              Submit
            </Button>
            <p className="max-w-[360px] text-[13px] leading-5 text-zinc-500">
              Your answers save as you go, so you can close this page and finish later on this device.
            </p>
          </div>
        </form>
      </main>
    </>
  );
}

/** Scrolls to the question's title and puts focus on its first input. */
function focusQuestion(questionId: string) {
  const question = document.getElementById(`question-${questionId}`);
  question?.scrollIntoView({ block: "start" });
  question?.querySelector<HTMLElement>("input, textarea")?.focus({ preventScroll: true });
}

const SAVE_LABELS: Record<SaveStatus | "restoring", { icon: ReactNode; text: string; className?: string } | null> = {
  idle: null,
  restoring: { icon: <SpinnerIcon size={14} />, text: "Restoring your answers…" },
  saving: { icon: <SpinnerIcon size={14} />, text: "Saving…" },
  saved: { icon: <CheckIcon size={14} className="text-green-600" />, text: "Progress saved" },
  offline: {
    icon: <OfflineIcon size={14} />,
    text: "You’re offline. Keep going, we’ll save when you’re back.",
    className: "text-amber-700",
  },
  failed: {
    icon: <AlertIcon size={14} />,
    text: "Couldn’t save your last answer. We’ll retry on your next change.",
    className: "text-red-700",
  },
};

function SaveIndicator({ status }: { status: SaveStatus | "restoring" }) {
  const label = SAVE_LABELS[status];
  return (
    <span role="status" className={cx("inline-flex items-center gap-1.5", label?.className)}>
      {label?.icon}
      {label?.text}
    </span>
  );
}

function Notice({
  tone = "info",
  icon,
  action,
  children,
}: {
  tone?: "info" | "error";
  icon: ReactNode;
  action: ReactNode;
  children: ReactNode;
}) {
  return (
    <div
      role={tone === "error" ? "alert" : "status"}
      className={cx(
        "flex animate-reveal flex-wrap items-center justify-between gap-x-4 gap-y-2 rounded-xl border px-4 py-3",
        tone === "error" ? "border-red-200 bg-red-50 text-red-800" : "border-blue-200 bg-blue-50 text-blue-950",
      )}
    >
      <p className="flex min-w-0 grow basis-[280px] items-start gap-2 leading-6">
        <span className="mt-1 shrink-0">{icon}</span>
        <span>{children}</span>
      </p>
      {action}
    </div>
  );
}

interface EndScreenProps {
  phase: Exclude<FormPhase, { kind: "answering" }>;
  title: string;
  headingRef: Ref<HTMLHeadingElement>;
  onRespondAgain: () => void;
}

function EndScreen({ phase, title, headingRef, onRespondAgain }: EndScreenProps) {
  const respondAgain = (
    <Button size="lg" onClick={onRespondAgain}>
      Submit another response
    </Button>
  );
  switch (phase.kind) {
    case "submitted":
      return (
        <FormEndState
          tone="success"
          icon={<CheckIcon size={22} />}
          title="Thanks, your answers are in"
          action={respondAgain}
          headingRef={headingRef}
        >
          Your response to “{title}” was submitted. You can close this tab.
        </FormEndState>
      );
    case "already-submitted":
      return (
        <FormEndState icon={<CheckIcon size={22} />} title="You’ve already responded" action={respondAgain} headingRef={headingRef}>
          We received your answers{phase.submittedAt && ` on ${formatDate(phase.submittedAt)}`}. Thanks for taking part.
        </FormEndState>
      );
    case "closed":
      return <SurveyClosed title={title} headingRef={headingRef} />;
    case "not-found":
      return <SurveyNotFound headingRef={headingRef} />;
  }
}
