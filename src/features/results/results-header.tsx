"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button, ButtonLink } from "@/components/ui/button";
import { ChevronLeftIcon, LinkIcon, LockIcon } from "@/components/ui/icons";
import { StatusBadge } from "@/components/ui/status-badge";
import { useToast } from "@/components/ui/toast";
import { useAction } from "@/components/ui/use-action";
import { api } from "@/lib/api-client";
import type { ApiResult } from "@/lib/api-contract";
import { useCopyLink } from "@/features/surveys/use-copy-link";
import type { SurveyDetail, SurveyStatus } from "@/server/surveys/service";

interface ResultsHeaderProps {
  surveyId: string;
  title: string;
  status: SurveyStatus;
  version: number | null;
  /** People partway through the live version: closing stops them from submitting. */
  inProgressCount: number;
}

const people = (n: number) => (n === 1 ? "1 person" : `${n} people`);

export function ResultsHeader({ surveyId, title, status: initialStatus, version, inProgressCount }: ResultsHeaderProps) {
  const router = useRouter();
  const toast = useToast();
  const copyLink = useCopyLink();
  const [status, setStatus] = useState(initialStatus);
  const isOpen = status === "published";

  const copy = useAction(
    async (): Promise<ApiResult<null>> =>
      (await copyLink(surveyId))
        ? { success: true, data: null }
        : { success: false, error: { code: "CLIPBOARD_BLOCKED", message: "Clipboard blocked" } },
  );
  const statusAction = useAction((next: "published" | "closed") =>
    api<SurveyDetail>(`/surveys/${surveyId}`, { method: "PATCH", body: { status: next } }),
  );

  async function changeStatus(next: "published" | "closed") {
    const result = await statusAction.run(next);
    if (!result) return;
    if (!result.success) {
      toast({ message: result.error.message, tone: "error" });
      return;
    }
    setStatus(result.data.status);
    router.refresh(); // The summary's wording depends on whether the survey is open.
    if (next === "closed") {
      const note = inProgressCount > 0
        ? `${people(inProgressCount)} partway through can’t submit until you reopen it.`
        : "The link now says it isn’t taking responses.";
      toast({ message: `Survey closed. ${note}`, action: { label: "Undo", onClick: () => void changeStatus("published") } });
    } else {
      toast({ message: "Survey reopened. The link takes responses again.", tone: "success" });
    }
  }

  return (
    <header className="border-b border-zinc-200 bg-white">
      <div className="mx-auto flex min-h-14 max-w-[1200px] flex-wrap items-center gap-x-3 gap-y-2 px-4 py-2 sm:px-6">
        <ButtonLink href="/surveys" variant="ghost" size="sm" icon={<ChevronLeftIcon />} className="-ml-2">
          Surveys
        </ButtonLink>
        <span aria-hidden="true" className="text-zinc-300">
          /
        </span>
        <span className="min-w-0 max-w-[420px] truncate font-semibold">{title}</span>
        <StatusBadge status={status} version={version} />
        <div className="ml-auto flex items-center gap-2">
          {isOpen && (
            <Button icon={<LinkIcon />} status={copy.status} doneLabel="Copied" onClick={() => void copy.run()}>
              <span className="sr-only sm:not-sr-only">Copy link</span>
            </Button>
          )}
          {status !== "draft" && (
            <Button
              icon={isOpen ? <LockIcon /> : undefined}
              status={statusAction.status}
              pendingLabel={isOpen ? "Closing…" : "Reopening…"}
              doneLabel={isOpen ? "Reopened" : "Closed"}
              title={isOpen ? "Stop accepting new responses" : "Start accepting responses again"}
              onClick={() => void changeStatus(isOpen ? "closed" : "published")}
            >
              {isOpen ? "Close survey" : "Reopen survey"}
            </Button>
          )}
          <ButtonLink href={`/surveys/${surveyId}/edit`} variant="primary">
            Edit survey
          </ButtonLink>
        </div>
      </div>
    </header>
  );
}
