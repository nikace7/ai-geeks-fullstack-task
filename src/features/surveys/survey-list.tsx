"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { buttonClasses } from "@/components/ui/button";
import { cx, fieldClasses } from "@/components/ui/cx";
import { LinkIcon, SearchIcon, TrashIcon } from "@/components/ui/icons";
import { StatusBadge } from "@/components/ui/status-badge";
import { useToast } from "@/components/ui/toast";
import { formatNumber, plural, timeAgo } from "@/lib/format";
import type { SurveyStatus, SurveySummary } from "@/server/surveys/service";
import { DeleteSurveyDialog } from "./delete-survey-dialog";
import { useCopyLink } from "./use-copy-link";

type Filter = "all" | SurveyStatus;

const TABS: { id: Filter; label: string; empty: string }[] = [
  { id: "all", label: "All", empty: "No surveys yet." },
  { id: "published", label: "Live", empty: "No live surveys. Publish a draft to start collecting responses." },
  { id: "draft", label: "Draft", empty: "No drafts. Every survey here has been published." },
  { id: "closed", label: "Closed", empty: "No closed surveys." },
];

const iconButton = buttonClasses({ variant: "ghost", size: "icon" });
const deleteButton = "grid size-8 place-items-center rounded-md text-zinc-600 transition-colors hover:bg-red-50 hover:text-red-700";

export function SurveyList({ surveys }: { surveys: SurveySummary[] }) {
  const router = useRouter();
  const toast = useToast();
  const copyLink = useCopyLink();
  const [filter, setFilter] = useState<Filter>("all");
  const [query, setQuery] = useState("");
  const [toDelete, setToDelete] = useState<SurveySummary | null>(null);
  // Hides a deleted row at once, instead of waiting for the refreshed list from the server.
  const [deletedIds, setDeletedIds] = useState<ReadonlySet<string>>(new Set());

  const remaining = surveys.filter((s) => !deletedIds.has(s.id));
  const needle = query.trim().toLowerCase();
  const rows = remaining.filter(
    (s) => (filter === "all" || s.status === filter) && s.title.toLowerCase().includes(needle),
  );
  const activeTab = TABS.find((t) => t.id === filter) ?? TABS[0];

  function handleDeleted(survey: SurveySummary) {
    setDeletedIds((ids) => new Set(ids).add(survey.id));
    setToDelete(null);
    toast({ message: `Deleted “${survey.title}”`, tone: "success" });
    router.refresh();
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-x-3 border-b border-zinc-200">
        <div className="flex gap-5" role="group" aria-label="Filter by status">
          {TABS.map((tab) => {
            const isActive = tab.id === filter;
            const count = tab.id === "all" ? remaining.length : remaining.filter((s) => s.status === tab.id).length;
            return (
              <button
                key={tab.id}
                type="button"
                aria-pressed={isActive}
                onClick={() => setFilter(tab.id)}
                className={cx(
                  "-mb-px flex h-10 items-center gap-1.5 font-medium transition-colors",
                  isActive ? "text-zinc-900 shadow-[inset_0_-2px_0_var(--color-zinc-900)]" : "text-zinc-500 hover:text-zinc-900",
                )}
              >
                {tab.label}
                <span className="font-mono text-xs text-zinc-500">{count}</span>
              </button>
            );
          })}
        </div>
        <div className="relative mb-2 w-full sm:w-60">
          <label htmlFor="survey-search" className="sr-only">
            Search surveys
          </label>
          <SearchIcon className="pointer-events-none absolute left-2.5 top-2.5 text-zinc-500" />
          <input
            id="survey-search"
            type="search"
            placeholder="Search surveys"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className={cx(fieldClasses, "h-9 pl-[34px]")}
          />
        </div>
      </div>

      {/* `relative` keeps the absolutely positioned sr-only header inside this scroll box;
          without it, that span widens the whole page on narrow screens. */}
      <div className="relative overflow-x-auto rounded-[10px] border border-zinc-200 bg-white">
        <table className="w-full min-w-[900px] table-fixed border-collapse text-left">
          <thead className="text-xs text-zinc-500">
            <tr>
              <th className="px-4 py-2.5 font-medium">Survey</th>
              <th className="w-[120px] px-4 py-2.5 font-medium">Status</th>
              <th className="w-[160px] px-4 py-2.5 font-medium">Version</th>
              <th className="w-[110px] px-4 py-2.5 text-right font-medium">Responses</th>
              <th className="w-[130px] px-4 py-2.5 font-medium">Updated</th>
              <th className="w-[220px] px-4 py-2.5 text-right font-medium">
                <span className="sr-only">Actions</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((survey) => (
              <SurveyRow
                key={survey.id}
                survey={survey}
                onCopyLink={() => copyLink(survey.id)}
                onDelete={() => setToDelete(survey)}
              />
            ))}
            {rows.length === 0 && (
              <tr className="border-t border-zinc-100">
                <td colSpan={6} className="px-4 py-12 text-center text-zinc-500">
                  {needle ? (
                    <>
                      No surveys match “{query.trim()}”.{" "}
                      <button
                        type="button"
                        onClick={() => setQuery("")}
                        className="font-medium text-zinc-900 underline-offset-2 hover:underline"
                      >
                        Clear search
                      </button>
                    </>
                  ) : (
                    activeTab.empty
                  )}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      <p className="text-xs text-zinc-500">
        Responses count completed submissions. Answers still in progress show on each survey&apos;s results page.
      </p>

      {toDelete && (
        <DeleteSurveyDialog key={toDelete.id} survey={toDelete} onClose={() => setToDelete(null)} onDeleted={handleDeleted} />
      )}
    </div>
  );
}

interface SurveyRowProps {
  survey: SurveySummary;
  onCopyLink: () => void;
  onDelete: () => void;
}

function SurveyRow({ survey, onCopyLink, onDelete }: SurveyRowProps) {
  const editHref = `/surveys/${survey.id}/edit` as const;
  const isPublished = survey.latestVersion !== null;
  const meta = plural(survey.questionCount, "question") + (survey.logicCount ? ` · ${survey.logicCount} with logic` : "");
  const versionNote = !isPublished
    ? { text: "Never published", tone: "text-zinc-500" }
    : survey.hasUnpublishedChanges
      ? { text: "Unpublished changes", tone: "text-amber-700" }
      : null;

  return (
    <tr className="border-t border-zinc-100 transition-colors hover:bg-zinc-50">
      <td className="px-4 py-3">
        <Link href={editHref} className="block truncate font-medium text-zinc-900 hover:text-blue-600">
          {survey.title}
        </Link>
        <span className="text-xs text-zinc-500">{meta}</span>
      </td>
      <td className="px-4 py-3">
        <StatusBadge status={survey.status} />
      </td>
      <td className="px-4 py-3">
        <span className="block font-mono text-[13px]">{isPublished ? `v${survey.latestVersion}` : "—"}</span>
        {versionNote && <span className={cx("text-xs", versionNote.tone)}>{versionNote.text}</span>}
      </td>
      <td className="px-4 py-3 text-right font-mono text-[13px]">
        {isPublished ? formatNumber(survey.responseCount) : "—"}
      </td>
      {/* Relative time differs by a few seconds between the server render and hydration. */}
      <td className="px-4 py-3 text-zinc-600" suppressHydrationWarning>
        {timeAgo(survey.updatedAt)}
      </td>
      <td className="px-3 py-3">
        <div className="flex items-center justify-end gap-0.5">
          <Link href={editHref} className={buttonClasses({ variant: "ghost", size: "sm" })}>
            Edit
          </Link>
          {isPublished && (
            <Link href={`/surveys/${survey.id}/results`} className={buttonClasses({ variant: "ghost", size: "sm" })}>
              Results
            </Link>
          )}
          {survey.status === "published" && (
            <button type="button" onClick={onCopyLink} aria-label={`Copy share link for ${survey.title}`} title="Copy share link" className={iconButton}>
              <LinkIcon />
            </button>
          )}
          <button type="button" onClick={onDelete} aria-label={`Delete ${survey.title}`} title="Delete" className={deleteButton}>
            <TrashIcon />
          </button>
        </div>
      </td>
    </tr>
  );
}
