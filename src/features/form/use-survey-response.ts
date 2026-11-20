"use client";

import { useCallback, useEffect, useRef, useState, useSyncExternalStore, type RefObject } from "react";
import { z } from "zod";
import type { AnswerValue, Answers, SurveyDefinition } from "@/core/survey-schema";
import { validateResponse, type ResponseMode } from "@/core/validate-response";
import { api } from "@/lib/api-client";
import type { ApiErrorBody, ApiResult } from "@/lib/api-contract";
import type { ResumableResponse, SavedResponse } from "@/server/responses/service";

/** Long enough to fold a typed sentence or a burst of clicks into one request. */
const SAVE_DELAY_MS = 1000;
const NO_ANSWERS: Answers = {};

export interface SurveyVersion {
  versionId: string;
  definition: SurveyDefinition;
}

export type SaveStatus = "idle" | "saving" | "saved" | "offline" | "failed";

export type FormPhase =
  | { kind: "answering" }
  | { kind: "submitted" }
  | { kind: "already-submitted"; submittedAt: string | null }
  | { kind: "closed" }
  | { kind: "not-found" };

const credentialsSchema = z.object({ responseId: z.uuid(), resumeToken: z.string().min(1) });
type Credentials = z.infer<typeof credentialsSchema>;

/** JSON turns the dates into strings on the way over. */
type Resumed = Omit<ResumableResponse, "startedAt" | "completedAt"> & { startedAt: string; completedAt: string | null };

const bearer = (token: string) => ({ authorization: `Bearer ${token}` });
const storageKey = (surveyId: string) => `survey-response:${surveyId}`;
const noSubscribe = () => () => {};

/**
 * The resume token lives in localStorage, one per survey. Storage can be missing or throw (private
 * windows, blocked site data); then resuming isn't offered, and answering and submitting still work.
 */
function readStored(surveyId: string): string | null {
  try {
    const raw = localStorage.getItem(storageKey(surveyId));
    return raw && credentialsSchema.safeParse(JSON.parse(raw)).success ? raw : null;
  } catch {
    return null;
  }
}

function writeStored(surveyId: string, credentials: Credentials | null): string {
  const raw = JSON.stringify(credentials);
  try {
    if (credentials) localStorage.setItem(storageKey(surveyId), raw);
    else localStorage.removeItem(storageKey(surveyId));
  } catch {
    // No storage: progress still saves on the server, it just can't be picked up after the tab closes.
  }
  return raw;
}

/** Failures that replace the form with a message, because there is nothing left to answer. */
function endPhaseFor(error: ApiErrorBody): FormPhase | null {
  switch (error.code) {
    case "SURVEY_CLOSED":
      return { kind: "closed" };
    case "ALREADY_SUBMITTED":
      return { kind: "already-submitted", submittedAt: null };
    case "NOT_FOUND":
      return { kind: "not-found" };
    default:
      return null;
  }
}

/**
 * A respondent's answers, saved as they go and resumable on the same device.
 *
 * The first save creates the response and returns a resume token; later saves and the final submit
 * update it. Every request runs through one queue, so a slow save can never land after the submit.
 *
 * The honeypot input belongs to the form; its value is read only when a request is sent.
 */
export function useSurveyResponse(
  surveyId: string,
  live: SurveyVersion,
  honeypotRef: RefObject<HTMLInputElement | null>,
) {
  const [version, setVersion] = useState(live);
  const [answers, setAnswers] = useState(NO_ANSWERS);
  const [savedAnswers, setSavedAnswers] = useState(NO_ANSWERS);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [phase, setPhase] = useState<FormPhase>({ kind: "answering" });
  const [saveFailure, setSaveFailure] = useState<"offline" | "failed" | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [restoredFrom, setRestoredFrom] = useState<string | null>(null);
  // The stored token this tab has already dealt with (restored it, or created it).
  const [handled, setHandled] = useState<{ raw: string; error?: string } | null>(null);

  // localStorage isn't readable during the server render, so the server snapshot is "nothing saved".
  const stored = useSyncExternalStore(noSubscribe, () => readStored(surveyId), () => null);
  const credentials = useRef<Credentials | null>(null);
  const queue = useRef<Promise<unknown>>(Promise.resolve());

  const isRestoring = stored !== null && handled?.raw !== stored;
  const restoreError = stored !== null && handled?.raw === stored ? (handled.error ?? null) : null;
  const isDirty = answers !== savedAnswers;
  const canAutosave =
    isDirty && phase.kind === "answering" && !saveFailure && !isSubmitting && !isRestoring && !restoreError;

  useEffect(() => {
    if (!isRestoring || stored === null) return;
    const saved = credentialsSchema.parse(JSON.parse(stored));
    let isCurrent = true;
    void api<Resumed>(`/public/responses/${saved.responseId}`, { headers: bearer(saved.resumeToken) }).then((result) => {
      if (!isCurrent) return;
      if (!result.success) {
        // An unknown token means the saved progress is gone, so start fresh instead of failing.
        const isStale = result.error.code === "NOT_FOUND";
        if (isStale) writeStored(surveyId, null);
        setHandled({ raw: stored, error: isStale ? undefined : result.error.message });
        return;
      }
      const response = result.data;
      credentials.current = saved;
      setHandled({ raw: stored });
      if (response.status === "completed") setPhase({ kind: "already-submitted", submittedAt: response.completedAt });
      else if (!response.acceptingResponses) setPhase({ kind: "closed" });
      else {
        // Finish the version they started, even if a newer one was published since.
        setVersion({ versionId: response.versionId, definition: response.definition });
        setAnswers(response.answers);
        setSavedAnswers(response.answers);
        setRestoredFrom(response.startedAt);
      }
    });
    return () => {
      isCurrent = false;
    };
  }, [isRestoring, stored, surveyId]);

  const send = useCallback(
    async (sent: Answers, mode: ResponseMode, keepalive = false): Promise<ApiResult<SavedResponse>> => {
      const saved = credentials.current;
      if (saved) {
        return api(`/public/responses/${saved.responseId}`, {
          method: "PUT",
          headers: bearer(saved.resumeToken),
          body: { answers: sent, mode },
          keepalive,
        });
      }
      const website = honeypotRef.current?.value || undefined;
      const result = await api<SavedResponse>(`/public/surveys/${surveyId}/responses`, {
        body: { versionId: version.versionId, answers: sent, mode, website },
        keepalive,
      });
      if (result.success && result.data.resumeToken) {
        credentials.current = { responseId: result.data.responseId, resumeToken: result.data.resumeToken };
        setHandled({ raw: writeStored(surveyId, credentials.current) });
      }
      return result;
    },
    [surveyId, version.versionId, honeypotRef],
  );

  const persist = useCallback(
    (sent: Answers, mode: ResponseMode, keepalive?: boolean) => {
      const task = queue.current.then(() => send(sent, mode, keepalive));
      queue.current = task;
      return task;
    },
    [send],
  );

  useEffect(() => {
    if (!canAutosave) return;
    async function save(keepalive?: boolean) {
      const result = await persist(answers, "partial", keepalive);
      if (result.success) return setSavedAnswers(answers);
      const end = endPhaseFor(result.error);
      if (end) setPhase(end);
      else setSaveFailure(result.error.code === "NETWORK_ERROR" ? "offline" : "failed");
    }
    const timer = setTimeout(save, SAVE_DELAY_MS);
    // Closing or leaving the tab inside the delay would drop the last answer, so save it now.
    // keepalive lets the request finish even when the page is going away.
    function saveOnHide() {
      if (document.visibilityState !== "hidden") return;
      clearTimeout(timer);
      void save(true);
    }
    document.addEventListener("visibilitychange", saveOnHide);
    return () => {
      clearTimeout(timer);
      document.removeEventListener("visibilitychange", saveOnHide);
    };
  }, [canAutosave, answers, persist]);

  // Clearing the failure re-arms the autosave above.
  useEffect(() => {
    if (saveFailure !== "offline") return;
    const retry = () => setSaveFailure(null);
    window.addEventListener("online", retry);
    return () => window.removeEventListener("online", retry);
  }, [saveFailure]);

  const setAnswer = useCallback((questionId: string, value: AnswerValue) => {
    setAnswers((current) => ({ ...current, [questionId]: value }));
    setErrors((current) =>
      Object.hasOwn(current, questionId) ? Object.fromEntries(Object.entries(current).filter(([id]) => id !== questionId)) : current,
    );
    setSaveFailure(null); // Each edit is a fresh attempt.
  }, []);

  function showErrors(fields: Record<string, string>): ApiResult<never> {
    setErrors(fields);
    return { success: false, error: { code: "VALIDATION_FAILED", message: "Some questions need an answer", details: { fields } } };
  }

  /** Checks the answers here first, so a missing answer is flagged without a round trip. */
  async function submit(): Promise<ApiResult<SavedResponse>> {
    const check = validateResponse(version.definition, answers, "complete");
    if (!check.success) return showErrors(check.errors);
    setIsSubmitting(true);
    const result = await persist(answers, "complete");
    setIsSubmitting(false);
    if (result.success) {
      setSavedAnswers(answers);
      setPhase({ kind: "submitted" });
      return result;
    }
    if (result.error.code === "VALIDATION_FAILED") return showErrors(result.error.details?.fields ?? {});
    const end = endPhaseFor(result.error);
    if (end) setPhase(end);
    return result;
  }

  /** Clears the answers but keeps the response, so the next autosave overwrites it. Returns what was cleared, for Undo. */
  function startOver(): Answers {
    setAnswers({});
    setErrors({});
    setRestoredFrom(null);
    return answers;
  }

  /** After submitting: forget this response on the device and show a blank form for the live version. */
  function startNewResponse() {
    credentials.current = null;
    writeStored(surveyId, null);
    setHandled(null);
    setVersion(live);
    setAnswers(NO_ANSWERS);
    setSavedAnswers(NO_ANSWERS);
    setErrors({});
    setRestoredFrom(null);
    setPhase({ kind: "answering" });
  }

  const saveStatus: SaveStatus = saveFailure ?? (isDirty ? "saving" : savedAnswers === NO_ANSWERS ? "idle" : "saved");

  return {
    definition: version.definition,
    answers,
    errors,
    phase,
    saveStatus,
    isRestoring,
    restoreError,
    restoredFrom,
    setAnswer,
    setAnswers,
    submit,
    startOver,
    startNewResponse,
    retryRestore: () => setHandled(null),
  };
}
