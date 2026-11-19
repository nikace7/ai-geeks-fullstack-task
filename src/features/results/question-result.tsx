import { QUESTION_TYPE_LABELS, RATING_MAX, type Question } from "@/core/survey-schema";
import { describeCondition } from "@/features/builder/changes";
import { formatNumber, percent, plural } from "@/lib/format";
import type { ChoiceStats, QuestionStats, RatingStats } from "@/server/analytics/service";
import { TextAnswers } from "./text-answers";

/** Tallest rating bar in px; the column above it holds the count label. */
const BAR_MAX_PX = 120;

interface QuestionResultProps {
  stats: QuestionStats;
  /** The same question from the version's definition, for its condition and required flag. */
  question: Question;
  index: number;
  questions: readonly Question[];
}

/** One question's results. The header says why counts differ: a question can be optional or only shown to some people. */
export function QuestionResult({ stats, question, index, questions }: QuestionResultProps) {
  const condition = question.showIf && describeCondition(question.showIf, questions);
  const meta = [
    `Q${index + 1}`,
    QUESTION_TYPE_LABELS[question.type],
    condition && `only shown if Q${condition.question} ${condition.operator} “${condition.value}”`,
    !question.required && "optional",
  ]
    .filter(Boolean)
    .join(" · ");
  const headingId = `result-${question.id}`;

  return (
    <section aria-labelledby={headingId} className="flex flex-col gap-4 rounded-xl border border-zinc-200 bg-white p-5 sm:p-6">
      <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1">
        <div className="flex min-w-0 flex-col gap-1">
          <span className="font-mono text-xs text-zinc-500">{meta}</span>
          <h2 id={headingId} className="break-words text-base font-semibold">
            {stats.title}
          </h2>
        </div>
        <span className="shrink-0 text-[13px] text-zinc-600">
          <span className="font-mono text-zinc-900">{formatNumber(stats.answered)}</span> answered
          {stats.type === "text" && stats.answered > 1 && " · newest first"}
        </span>
      </div>
      {stats.answered === 0 ? (
        <p className="text-zinc-500">
          No answers yet.{condition && " It only appears for people whose earlier answer matches."}
        </p>
      ) : (
        <StatsBody stats={stats} />
      )}
    </section>
  );
}

function StatsBody({ stats }: { stats: QuestionStats }) {
  switch (stats.type) {
    case "single_choice":
    case "multi_choice":
      return <ChoiceBars stats={stats} />;
    case "rating":
      return <RatingHistogram stats={stats} />;
    case "text":
      return <TextAnswers answers={stats.latestAnswers} answered={stats.answered} />;
  }
}

/** Options keep the order respondents saw, so a bar never changes place between versions or refreshes. */
function ChoiceBars({ stats }: { stats: ChoiceStats }) {
  return (
    <>
      <ul className="flex max-w-[760px] flex-col gap-3">
        {stats.options.map((option) => {
          const share = percent(option.count, stats.answered);
          return (
            <li
              key={option.id}
              title={`${option.label}: ${option.count} of ${stats.answered} (${share}%)`}
              className="flex flex-col gap-1.5"
            >
              <div className="flex justify-between gap-3">
                <span className="min-w-0 break-words">{option.label}</span>
                <span className="shrink-0 font-mono tabular-nums">
                  {formatNumber(option.count)} <span className="text-zinc-500">· {share}%</span>
                </span>
              </div>
              <div aria-hidden="true" className="h-2 overflow-hidden rounded bg-zinc-100">
                <div className="h-full rounded-r bg-blue-600" style={{ width: `${(option.count / stats.answered) * 100}%` }} />
              </div>
            </li>
          );
        })}
      </ul>
      {stats.type === "multi_choice" && (
        <p className="text-xs text-zinc-500">People could pick more than one, so the percentages can add up to more than 100%.</p>
      )}
    </>
  );
}

function RatingHistogram({ stats }: { stats: RatingStats }) {
  const peak = Math.max(...stats.distribution.map((d) => d.count));
  const summary = stats.distribution.map((d) => `${d.rating}: ${d.count}`).join(", ");

  return (
    <div className="flex flex-wrap items-end gap-x-12 gap-y-6">
      <div className="flex min-w-[140px] flex-col gap-1">
        <span className="text-5xl font-semibold tabular-nums tracking-tight">
          {stats.average === null ? "—" : formatNumber(stats.average)}
        </span>
        <span className="text-[13px] text-zinc-600">average out of {RATING_MAX}</span>
      </div>
      <figure className="flex max-w-[520px] grow basis-[280px] flex-col gap-2">
        <div
          role="img"
          aria-label={`Number of ratings for each score. ${summary}`}
          className="grid h-[150px] grid-cols-5 items-end gap-3 border-b border-zinc-200"
        >
          {stats.distribution.map(({ rating, count }) => (
            <div
              key={rating}
              title={`${rating}: ${plural(count, "rating")} (${percent(count, stats.answered)}%)`}
              className="flex h-full flex-col items-center justify-end gap-1.5"
            >
              <span className="font-mono text-xs text-zinc-600">{formatNumber(count)}</span>
              {/* A score anyone picked keeps a sliver of bar, so it never reads as zero. */}
              <div
                className="w-full max-w-14 rounded-t bg-blue-600"
                style={{ height: count ? Math.max(2, (count / peak) * BAR_MAX_PX) : 0 }}
              />
            </div>
          ))}
        </div>
        <div aria-hidden="true" className="grid grid-cols-5 gap-3 text-center font-mono text-xs text-zinc-600">
          {stats.distribution.map(({ rating }) => (
            <span key={rating}>{rating}</span>
          ))}
        </div>
      </figure>
    </div>
  );
}
