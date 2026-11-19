import type { SurveyStatus } from "@/server/surveys/service";
import { cx } from "./cx";

const STATUS = {
  published: { label: "Live", badge: "bg-green-50 text-green-700", dot: "bg-green-600" },
  draft: { label: "Draft", badge: "bg-amber-50 text-amber-700", dot: "bg-amber-600" },
  closed: { label: "Closed", badge: "bg-zinc-100 text-zinc-600", dot: "bg-zinc-400" },
} as const;

/** Colour plus a text label, so status never relies on colour alone. */
export function StatusBadge({ status, version }: { status: SurveyStatus; version?: number | null }) {
  const { label, badge, dot } = STATUS[status];
  return (
    <span className={cx("inline-flex h-[22px] shrink-0 items-center gap-1.5 rounded-full px-2 text-xs font-medium", badge)}>
      <span aria-hidden="true" className={cx("size-1.5 rounded-full", dot)} />
      {label}
      {status !== "draft" && version ? ` · v${version}` : null}
    </span>
  );
}

export function Pill({ tone, children }: { tone: "amber" | "blue"; children: React.ReactNode }) {
  return (
    <span
      className={cx(
        "inline-flex h-[22px] shrink-0 items-center rounded-full px-2 text-xs font-medium",
        tone === "amber" ? "bg-amber-50 text-amber-700" : "bg-blue-50 text-blue-700",
      )}
    >
      {children}
    </span>
  );
}
