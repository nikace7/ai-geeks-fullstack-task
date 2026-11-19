import type { Metadata } from "next";
import { notFound } from "next/navigation";
import type { ReactNode } from "react";
import { z } from "zod";
import { ButtonLink } from "@/components/ui/button";
import { ChartIcon } from "@/components/ui/icons";
import { QuestionResult } from "@/features/results/question-result";
import { ResultsHeader } from "@/features/results/results-header";
import { VersionPicker } from "@/features/results/version-picker";
import { formatDate, formatNumber, percent, timeAgo } from "@/lib/format";
import { getSurveyAnalytics, type SurveyAnalytics } from "@/server/analytics/service";
import { requireAdmin } from "@/server/auth/current-admin";
import { ApiError } from "@/server/http/errors";
import { findSurvey } from "@/server/surveys/service";

export const metadata: Metadata = { title: "Results" };

/** ?v=N picks an older version. Anything that isn't a positive whole number falls back to the latest. */
const versionParam = z.coerce.number().int().positive().optional();

export default async function ResultsPage({ params, searchParams }: PageProps<"/surveys/[surveyId]/results">) {
  const [{ surveyId }, { v }, admin] = await Promise.all([params, searchParams, requireAdmin()]);
  const survey = await findSurvey(admin.id, surveyId);
  if (!survey) notFound();

  const header = (
    <ResultsHeader
      surveyId={survey.id}
      title={survey.published?.title ?? survey.draft.title}
      status={survey.status}
      version={survey.latestVersion}
      inProgressCount={survey.inProgressCount}
    />
  );

  if (survey.latestVersion === null) {
    return (
      <>
        {header}
        <Main>
          <EmptyCard
            title="No results yet"
            action={
              <ButtonLink href={`/surveys/${survey.id}/edit`} variant="primary">
                Open the builder
              </ButtonLink>
            }
          >
            Publish this survey to get a share link. Responses show up here as people submit them.
          </EmptyCard>
        </Main>
      </>
    );
  }

  const analytics = await getSurveyAnalytics(admin.id, survey.id, versionParam.safeParse(v).data).catch((error: unknown) => {
    if (error instanceof ApiError && error.status === 404) notFound(); // a version that doesn't exist
    throw error;
  });
  const selected = analytics.versions.find((version) => version.version === analytics.version) ?? analytics.versions[0];
  const isLatest = selected.version === survey.latestVersion;
  const { definition } = analytics;

  return (
    <>
      {header}
      <Main>
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div className="flex max-w-[640px] flex-col gap-1">
            <h1 className="text-2xl font-semibold tracking-tight">Results</h1>
            <p className="text-zinc-600">
              Completed responses to version {selected.version}, published {formatDate(selected.publishedAt)}.
              {isLatest
                ? " Partial answers aren’t counted until they’re submitted."
                : " A newer version is live, so these questions may differ from what people see now."}
            </p>
          </div>
          {analytics.versions.length > 1 && <VersionPicker versions={analytics.versions} selected={selected.version} />}
        </div>

        <Summary analytics={analytics} lastCompletedAt={selected.lastCompletedAt} isClosed={survey.status === "closed"} />

        {analytics.completed === 0 || !definition ? (
          <EmptyCard title={`No responses to v${selected.version} yet`}>
            {!isLatest
              ? `Nobody submitted this version before version ${survey.latestVersion} replaced it.`
              : survey.status === "closed"
                ? "This survey is closed. Reopen it to start collecting responses again."
                : "Share the link. Charts and answers show up here as people submit."}
          </EmptyCard>
        ) : (
          analytics.questions.map((stats, i) => (
            <QuestionResult
              key={stats.questionId}
              stats={stats}
              question={definition.questions[i]}
              index={i}
              questions={definition.questions}
            />
          ))
        )}
      </Main>
    </>
  );
}

function Main({ children }: { children: ReactNode }) {
  return <main className="mx-auto flex max-w-[1200px] flex-col gap-6 px-4 pb-16 pt-8 sm:px-6">{children}</main>;
}

interface SummaryProps {
  analytics: SurveyAnalytics;
  lastCompletedAt: Date | null;
  isClosed: boolean;
}

/** Headline numbers. Hairline dividers come from a 1px gap over a tinted background, so they hold at any column count. */
function Summary({ analytics: { completed, inProgress }, lastCompletedAt, isClosed }: SummaryProps) {
  const started = completed + inProgress;
  const tiles = [
    { label: "Completed", value: formatNumber(completed), note: "Submitted responses" },
    {
      label: "In progress",
      value: formatNumber(inProgress),
      note: isClosed ? "Can’t submit while closed" : "Saved partway, can resume",
    },
    {
      label: "Completion rate",
      value: started ? `${percent(completed, started)}%` : "—",
      note: started ? `${formatNumber(completed)} of ${formatNumber(started)} who started` : "Nobody has started yet",
    },
    {
      label: "Latest response",
      value: lastCompletedAt ? timeAgo(lastCompletedAt) : "—",
      note: lastCompletedAt ? formatDate(lastCompletedAt) : "None yet",
    },
  ];

  return (
    <section
      aria-label="Summary"
      className="grid grid-cols-2 gap-px overflow-hidden rounded-xl border border-zinc-200 bg-zinc-100 lg:grid-cols-4"
    >
      {tiles.map((tile) => (
        <div key={tile.label} className="flex flex-col gap-1 bg-white px-4 py-4 sm:px-6 sm:py-5">
          <span className="text-xs font-medium text-zinc-600">{tile.label}</span>
          <span className="text-xl font-semibold tabular-nums tracking-tight sm:text-[32px] sm:leading-10">{tile.value}</span>
          <span className="text-xs text-zinc-500">{tile.note}</span>
        </div>
      ))}
    </section>
  );
}

function EmptyCard({ title, action, children }: { title: string; action?: ReactNode; children: ReactNode }) {
  return (
    <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed border-zinc-300 bg-white px-6 py-16 text-center">
      <span className="grid size-11 place-items-center rounded-[10px] bg-zinc-100 text-zinc-600">
        <ChartIcon size={20} />
      </span>
      <h2 className="text-base font-semibold">{title}</h2>
      <p className="max-w-[440px] text-zinc-600">{children}</p>
      {action && <div className="mt-1">{action}</div>}
    </div>
  );
}
