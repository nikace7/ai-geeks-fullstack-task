"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { formatDate, timeAgo } from "@/lib/format";
import type { TextStats } from "@/server/analytics/service";

/** Answers shown before "Show more", enough to get the gist without a wall of text. */
const PREVIEW_COUNT = 5;

export function TextAnswers({ answers, answered }: { answers: TextStats["latestAnswers"]; answered: number }) {
  const [isExpanded, setIsExpanded] = useState(false);
  const shown = isExpanded ? answers : answers.slice(0, PREVIEW_COUNT);
  const more = answers.length - PREVIEW_COUNT;

  return (
    <div className="flex flex-col gap-3">
      <ul className="max-w-[760px]">
        {shown.map((answer, i) => (
          // The list is append-only and never reordered on the client, so the index is a stable key.
          <li key={i} className="flex flex-col gap-1 border-t border-zinc-100 py-3 sm:flex-row sm:justify-between sm:gap-6">
            <span className="min-w-0 whitespace-pre-line break-words">{answer.value}</span>
            {/* Relative time can differ by a few seconds between the server render and hydration. */}
            <time
              dateTime={answer.submittedAt.toISOString()}
              title={formatDate(answer.submittedAt)}
              suppressHydrationWarning
              className="shrink-0 text-xs text-zinc-500"
            >
              {timeAgo(answer.submittedAt)}
            </time>
          </li>
        ))}
      </ul>
      {more > 0 && (
        <Button size="sm" aria-expanded={isExpanded} onClick={() => setIsExpanded(!isExpanded)} className="self-start">
          {isExpanded ? "Show fewer" : `Show ${more} more`}
        </Button>
      )}
      {isExpanded && answered > answers.length && (
        <p className="text-xs text-zinc-500">
          Showing the newest {answers.length} of {answered} answers.
        </p>
      )}
    </div>
  );
}
