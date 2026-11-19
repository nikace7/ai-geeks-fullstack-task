"use client";

import { useEffect, useRef, useState } from "react";
import type { ApiErrorBody, ApiResult } from "@/lib/api-contract";
import type { ActionStatus } from "./button";

/**
 * Runs an API call and tracks its feedback state for a Button: pending while in flight, done for a
 * moment after success, error (with the server's message) after failure. A second call while one is
 * in flight is ignored, which covers the double click that lands before React re-renders.
 */
export function useAction<Args extends unknown[], T>(
  action: (...args: Args) => Promise<ApiResult<T>>,
  { doneMs = 1500 }: { doneMs?: number } = {},
) {
  const [status, setStatus] = useState<ActionStatus>("idle");
  const [error, setError] = useState<ApiErrorBody | null>(null);
  const inFlight = useRef(false);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);

  useEffect(() => () => clearTimeout(timer.current), []);

  async function run(...args: Args): Promise<ApiResult<T> | null> {
    if (inFlight.current) return null;
    inFlight.current = true;
    clearTimeout(timer.current);
    setStatus("pending");
    setError(null);

    const result = await action(...args);
    inFlight.current = false;
    if (result.success) {
      setStatus("done");
      timer.current = setTimeout(() => setStatus("idle"), doneMs);
    } else {
      setStatus("error");
      setError(result.error);
    }
    return result;
  }

  function reset() {
    clearTimeout(timer.current);
    setStatus("idle");
    setError(null);
  }

  return { run, status, error, reset };
}
