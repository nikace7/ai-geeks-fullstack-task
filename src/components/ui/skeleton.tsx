import type { CSSProperties } from "react";
import { cx } from "./cx";

/** A grey placeholder block for loading states. Shapes mirror the real layout so nothing jumps when data arrives. */
export function Skeleton({ className, style }: { className: string; style?: CSSProperties }) {
  return <span aria-hidden="true" style={style} className={cx("block animate-pulse rounded-md bg-zinc-200/70", className)} />;
}

/** Announces loading once to screen readers; the skeleton blocks themselves are hidden from them. */
export function LoadingLabel({ children }: { children: string }) {
  return (
    <span role="status" className="sr-only">
      {children}
    </span>
  );
}
