"use client";

import { useRef, useState } from "react";
import { Button, ButtonLink } from "@/components/ui/button";
import { cx } from "@/components/ui/cx";
import { Dialog } from "@/components/ui/dialog";
import { FormError } from "@/components/ui/field";
import { CheckIcon, ExternalIcon, LinkIcon } from "@/components/ui/icons";
import { useAction } from "@/components/ui/use-action";
import type { SurveyDefinition } from "@/core/survey-schema";
import { api } from "@/lib/api-client";
import type { ApiResult } from "@/lib/api-contract";
import { plural, publicSurveyUrl } from "@/lib/format";
import type { PublishedVersion, SurveyStatus } from "@/server/surveys/service";
import { diffSurveys, type Change } from "./changes";

export interface LiveState {
  status: SurveyStatus;
  version: number | null;
  /** The definition respondents see now. Null until the first publish. */
  definition: SurveyDefinition | null;
  inProgressCount: number;
}

interface PublishDialogProps {
  surveyId: string;
  live: LiveState;
  draft: SurveyDefinition;
  /** Saves any pending edit first, so what gets published is exactly what is on screen. */
  flush: () => Promise<boolean>;
  onClose: () => void;
  onPublished: (published: PublishedVersion) => void;
}

const SAVE_FAILED = {
  success: false,
  error: { code: "SAVE_FAILED", message: "Your latest edits couldn’t be saved, so nothing was published." },
} as const;

/** Two steps: confirm what changes for respondents, then share the link. */
export function PublishDialog({ surveyId, live, draft, flush, onClose, onPublished }: PublishDialogProps) {
  const [published, setPublished] = useState<PublishedVersion | null>(null);
  const { run, status, error } = useAction(
    async (): Promise<ApiResult<PublishedVersion>> =>
      (await flush()) ? api<PublishedVersion>(`/surveys/${surveyId}/publish`, { method: "POST" }) : SAVE_FAILED,
  );
  const isPending = status === "pending";

  async function handlePublish() {
    const result = await run();
    if (!result?.success) return;
    setPublished(result.data);
    onPublished(result.data);
  }

  return (
    <Dialog onClose={onClose} labelledBy="publish-title" dismissible={!isPending} className="w-[min(520px,calc(100%-32px))]">
      {published ? (
        <ShareStep surveyId={surveyId} version={published.version} isFirst={published.version === 1} onClose={onClose} />
      ) : (
        <>
          <div className="flex flex-col gap-4 p-6">
            <h2 id="publish-title" className="text-base font-semibold">
              {live.version === null ? "Publish this survey?" : `Publish version ${live.version + 1}?`}
            </h2>
            {live.definition && live.version !== null ? (
              <ChangeList changes={diffSurveys(live.definition, draft)} />
            ) : (
              <FirstPublishSummary draft={draft} />
            )}
            <PublishNote live={live} />
            {error && <FormError>Couldn’t publish. {error.message}</FormError>}
          </div>
          <div className="flex justify-end gap-2 border-t border-zinc-100 bg-zinc-50 px-6 py-4">
            <Button onClick={onClose} disabled={isPending}>
              Keep editing
            </Button>
            <Button
              variant="primary"
              status={status === "done" ? "pending" : status}
              pendingLabel="Publishing…"
              onClick={handlePublish}
            >
              {error ? "Try again" : live.version === null ? "Publish" : `Publish v${live.version + 1}`}
            </Button>
          </div>
        </>
      )}
    </Dialog>
  );
}

const KIND_STYLES: Record<Change["kind"], string> = {
  Added: "bg-green-50 text-green-700",
  Edited: "bg-blue-50 text-blue-700",
  Removed: "bg-red-50 text-red-700",
  Moved: "bg-zinc-100 text-zinc-600",
};

function ChangeList({ changes }: { changes: Change[] }) {
  return (
    <div className="flex flex-col gap-2">
      <p className="text-zinc-600">What changes for new respondents:</p>
      <ul className="flex max-h-60 flex-col divide-y divide-zinc-100 overflow-y-auto rounded-lg border border-zinc-200">
        {changes.map((change, i) => (
          <li key={i} className="flex items-start gap-2.5 px-3 py-2">
            <span className={cx("mt-px w-[62px] shrink-0 rounded-full py-0.5 text-center text-xs font-medium", KIND_STYLES[change.kind])}>
              {change.kind}
            </span>
            <span className="min-w-0">
              <span className="break-words">{change.label}</span>
              {change.detail && <span className="text-zinc-500"> · {change.detail}</span>}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function FirstPublishSummary({ draft }: { draft: SurveyDefinition }) {
  const conditional = draft.questions.filter((q) => q.showIf).length;
  return (
    <p className="text-zinc-600">
      Respondents will see “{draft.title}” with {plural(draft.questions.length, "question")}
      {conditional > 0 && `, ${conditional} of them only after certain answers`}. After publishing, you can keep
      editing: changes stay private until you publish again.
    </p>
  );
}

function PublishNote({ live }: { live: LiveState }) {
  const { version, inProgressCount, status } = live;
  if (version === null) return null;
  const partway =
    inProgressCount > 0
      ? `${inProgressCount === 1 ? "1 person is" : `${inProgressCount} people are`} partway through v${version}. They can still finish it, and `
      : "";
  return (
    <p className="rounded-lg bg-zinc-50 px-3 py-2.5 text-[13px] text-zinc-600">
      {partway ? `${partway}v${version}’s results` : `Results from v${version}`} stay exactly as they are. Each version keeps
      its own results.
      {status === "closed" && " Publishing also reopens the survey to new responses."}
    </p>
  );
}

function ShareStep({ surveyId, version, isFirst, onClose }: { surveyId: string; version: number; isFirst: boolean; onClose: () => void }) {
  const url = publicSurveyUrl(surveyId);
  const inputRef = useRef<HTMLInputElement>(null);
  // Toasts sit behind a modal dialog, so copy feedback stays on the button and under the field.
  const copy = useAction(async (): Promise<ApiResult<null>> => {
    try {
      await navigator.clipboard.writeText(url);
      return { success: true, data: null };
    } catch {
      inputRef.current?.select();
      return { success: false, error: { code: "CLIPBOARD_BLOCKED", message: "Press Ctrl+C (⌘C on a Mac) to copy the selected link." } };
    }
  });

  return (
    <>
      <div className="flex flex-col gap-4 p-6">
        <div className="flex flex-col gap-3">
          <span className="grid size-10 place-items-center rounded-full bg-green-50 text-green-600">
            <CheckIcon size={20} />
          </span>
          <h2 id="publish-title" className="text-base font-semibold">
            {isFirst ? "Your survey is live" : `Version ${version} is live`}
          </h2>
          <p className="text-zinc-600">Anyone with this link can respond. No sign-in needed.</p>
        </div>
        <div className="flex flex-col gap-1.5">
          <div className="flex gap-2">
            <label htmlFor="share-link" className="sr-only">
              Share link
            </label>
            <input
              ref={inputRef}
              id="share-link"
              readOnly
              value={url}
              onFocus={(e) => e.target.select()}
              className="h-10 min-w-0 grow rounded-lg border border-zinc-200 bg-zinc-50 px-3 font-mono text-[13px] text-zinc-700"
            />
            <Button size="lg" icon={<LinkIcon />} status={copy.status} doneLabel="Copied" onClick={() => void copy.run()}>
              Copy link
            </Button>
          </div>
          {copy.error && <p className="text-[13px] text-zinc-600">{copy.error.message}</p>}
        </div>
        <a
          href={`/s/${surveyId}`}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 self-start font-medium text-blue-700 hover:underline"
        >
          Open the form as a respondent
          <ExternalIcon size={14} />
        </a>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-zinc-100 bg-zinc-50 px-6 py-4">
        <span className="text-xs text-zinc-500">Stop taking responses any time with Close survey.</span>
        <div className="flex gap-2">
          <Button onClick={onClose}>Done</Button>
          <ButtonLink href={`/surveys/${surveyId}/results`} variant="primary">
            View results
          </ButtonLink>
        </div>
      </div>
    </>
  );
}
