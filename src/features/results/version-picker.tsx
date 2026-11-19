"use client";

import { usePathname, useRouter } from "next/navigation";
import { useTransition } from "react";
import { cx, fieldClasses } from "@/components/ui/cx";
import { SpinnerIcon } from "@/components/ui/icons";
import { formatDate, plural } from "@/lib/format";
import type { VersionSummary } from "@/server/analytics/service";

/** Switches the results between published versions. The latest version is the plain URL; older ones add ?v=N. */
export function VersionPicker({ versions, selected }: { versions: VersionSummary[]; selected: number }) {
  const router = useRouter();
  const pathname = usePathname();
  const [isPending, startTransition] = useTransition();
  const latest = versions[0].version;

  function handleChange(version: number) {
    startTransition(() => router.push(version === latest ? pathname : `${pathname}?v=${version}`, { scroll: false }));
  }

  return (
    <div className="flex flex-col gap-1">
      <label htmlFor="version-picker" className="text-xs font-medium text-zinc-600">
        Version
      </label>
      <div className="flex items-center gap-2">
        {/* Uncontrolled and keyed by the URL's version, so it shows the pick at once and follows Back/Forward. */}
        <select
          key={selected}
          id="version-picker"
          defaultValue={selected}
          onChange={(e) => handleChange(Number(e.target.value))}
          className={cx(fieldClasses, "h-9 sm:w-[260px]")}
        >
          {versions.map((v) => (
            <option key={v.version} value={v.version}>
              v{v.version} · {v.version === latest ? "current" : formatDate(v.publishedAt)} · {plural(v.completed, "response")}
            </option>
          ))}
        </select>
        <span role="status" className="flex size-4 items-center text-zinc-500">
          {isPending && (
            <>
              <SpinnerIcon />
              <span className="sr-only">Loading version</span>
            </>
          )}
        </span>
      </div>
    </div>
  );
}
