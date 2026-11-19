"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { SurveyDefinition } from "@/core/survey-schema";
import { api } from "@/lib/api-client";

const SAVE_DELAY_MS = 800;

export type SaveState = "saved" | "saving" | "error";

/**
 * Saves the draft shortly after the admin stops typing. Only valid drafts are sent: the server
 * rejects invalid ones anyway, and the builder already shows what to fix.
 *
 * Saves run one at a time, in order, so a slow early save can never land after a later one and
 * overwrite newer work.
 */
export function useAutosave(surveyId: string, draft: SurveyDefinition, isValid: boolean) {
  const [saved, setSaved] = useState(draft);
  const [error, setError] = useState<string | null>(null);
  const queue = useRef(Promise.resolve(true));
  const unsaved = useRef<SurveyDefinition | null>(null);

  const save = useCallback(
    (next: SurveyDefinition) => {
      setError(null);
      queue.current = queue.current.then(async () => {
        const result = await api(`/surveys/${surveyId}`, { method: "PUT", body: { draft: next } });
        if (result.success) setSaved(next);
        else setError(result.error.message);
        return result.success;
      });
      return queue.current;
    },
    [surveyId],
  );

  // Every edit replaces the draft object, so identity tells us whether it changed since the last save.
  const isDirty = draft !== saved;

  useEffect(() => {
    if (!isDirty || !isValid) return;
    const timer = setTimeout(() => save(draft), SAVE_DELAY_MS);
    return () => clearTimeout(timer);
  }, [draft, isDirty, isValid, save]);

  // Leaving within the debounce window (Back link, or Next.js hiding the route) would drop the
  // last edit, so save whatever is pending on the way out.
  useEffect(() => {
    unsaved.current = isDirty && isValid ? draft : null;
  });
  useEffect(
    () => () => {
      if (unsaved.current) void save(unsaved.current);
    },
    [save],
  );

  // Closing the tab can't wait for a request, so ask the browser to confirm instead.
  useEffect(() => {
    if (!isDirty) return;
    const confirmLeave = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", confirmLeave);
    return () => window.removeEventListener("beforeunload", confirmLeave);
  }, [isDirty]);

  const state: SaveState = error ? "error" : isDirty ? "saving" : "saved";

  return {
    state,
    error,
    retry: () => save(draft),
    /** Resolves once the current draft is on the server; false if that save failed. */
    flush: () => (isDirty ? save(draft) : Promise.resolve(true)),
  };
}
