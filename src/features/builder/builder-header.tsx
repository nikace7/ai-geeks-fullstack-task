"use client";

import { Button, ButtonLink } from "@/components/ui/button";
import { AlertIcon, ChartIcon, CheckIcon, ChevronLeftIcon, RetryIcon, SpinnerIcon } from "@/components/ui/icons";
import { Pill, StatusBadge } from "@/components/ui/status-badge";
import { plural } from "@/lib/format";
import type { SurveyStatus } from "@/server/surveys/service";
import type { SaveState } from "./use-autosave";

interface BuilderHeaderProps {
  surveyId: string;
  title: string;
  status: SurveyStatus;
  version: number | null;
  hasUnpublishedChanges: boolean;
  save: { state: SaveState; error: string | null; retry: () => void };
  issueCount: number;
  onShowIssue: () => void;
  /** Why publishing isn't possible right now, or null when it is. */
  publishBlockedBy: string | null;
  onPublish: () => void;
}

export function BuilderHeader({
  surveyId,
  title,
  status,
  version,
  hasUnpublishedChanges,
  save,
  issueCount,
  onShowIssue,
  publishBlockedBy,
  onPublish,
}: BuilderHeaderProps) {
  return (
    <header className="sticky top-0 z-20 border-b border-zinc-200 bg-white">
      <div className="flex h-14 items-center gap-2 px-4 sm:gap-3 sm:px-6">
        <ButtonLink href="/surveys" variant="ghost" size="sm" icon={<ChevronLeftIcon />} className="-ml-2">
          <span className="sr-only sm:not-sr-only">Surveys</span>
        </ButtonLink>
        <span aria-hidden="true" className="hidden text-zinc-300 sm:inline">
          /
        </span>
        <span className="hidden min-w-0 max-w-[320px] truncate font-semibold sm:inline">{title}</span>
        <StatusBadge status={status} version={version} />
        {status !== "draft" && hasUnpublishedChanges && (
          <span className="hidden md:inline-flex">
            <Pill tone="amber">Unpublished changes</Pill>
          </span>
        )}
        <div className="grow" />
        <SaveStatus {...save} issueCount={issueCount} onShowIssue={onShowIssue} />
        {version !== null && (
          // `contents` lets the link sit in the flex row while the wrapper hides it on small screens.
          <span className="hidden md:contents">
            <ButtonLink href={`/surveys/${surveyId}/results`} variant="ghost" icon={<ChartIcon />}>
              Results
            </ButtonLink>
          </span>
        )}
        <Button
          variant="primary"
          disabled={publishBlockedBy !== null}
          title={publishBlockedBy ?? undefined}
          onClick={onPublish}
        >
          {/* One text run, so the accessible name keeps its space: "Publish changes". */}
          <span>
            Publish{version !== null && <span className="hidden sm:inline"> changes</span>}
          </span>
        </Button>
      </div>
    </header>
  );
}

/** The autosave indicator. Issues win over everything: an invalid draft isn't being saved at all. */
function SaveStatus({
  state,
  error,
  retry,
  issueCount,
  onShowIssue,
}: BuilderHeaderProps["save"] & { issueCount: number; onShowIssue: () => void }) {
  return (
    <div role="status" className="flex items-center text-[13px]">
      {issueCount > 0 ? (
        <button
          type="button"
          onClick={onShowIssue}
          title="Show the first issue"
          className="inline-flex h-8 items-center gap-1.5 rounded-md px-2 text-red-700 hover:bg-red-50"
        >
          <AlertIcon size={14} />
          Not saved · {plural(issueCount, "issue")} to fix
        </button>
      ) : state === "error" ? (
        <span className="inline-flex items-center gap-1 text-red-700" title={error ?? undefined}>
          <AlertIcon size={14} />
          <span className="hidden sm:inline">Couldn’t save</span>
          <Button variant="ghost" size="sm" icon={<RetryIcon size={14} />} onClick={retry}>
            Retry
          </Button>
        </span>
      ) : state === "saving" ? (
        <span className="inline-flex items-center gap-1.5 text-zinc-500">
          <SpinnerIcon size={14} />
          Saving…
        </span>
      ) : (
        <span className="inline-flex items-center gap-1.5 text-zinc-600">
          <CheckIcon size={14} className="text-green-600" />
          <span className="hidden sm:inline">All changes saved</span>
          <span className="sm:hidden">Saved</span>
        </span>
      )}
    </div>
  );
}
