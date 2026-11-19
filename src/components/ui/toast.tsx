"use client";

import { createContext, use, useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { AlertIcon, CheckIcon, XIcon } from "./icons";

type Tone = "success" | "error" | "neutral";

interface ToastInput {
  message: string;
  tone?: Tone;
  action?: { label: string; onClick: () => void };
}

interface Toast extends ToastInput {
  id: number;
}

const SUCCESS_MS = 4000;
// Long enough to read the message, notice the mistake and reach the Undo button.
const ACTION_MS = 8000;

const ToastContext = createContext<(toast: ToastInput) => void>(() => {});

/** Shows one toast at a time, bottom centre. Success hides on its own; an error stays until dismissed. */
export function ToastProvider({ children }: { children: ReactNode }) {
  const [toast, setToast] = useState<Toast | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);

  useEffect(() => () => clearTimeout(timer.current), []);

  const show = useCallback((input: ToastInput) => {
    clearTimeout(timer.current);
    setToast({ ...input, id: Date.now() });
    if (input.tone !== "error") timer.current = setTimeout(() => setToast(null), input.action ? ACTION_MS : SUCCESS_MS);
  }, []);

  const dismiss = () => setToast(null);

  return (
    <ToastContext value={show}>
      {children}
      {/* The live region is always mounted, so screen readers announce toasts as they appear. */}
      <div
        role="status"
        aria-live="polite"
        className="pointer-events-none fixed inset-x-0 bottom-6 z-50 flex justify-center px-4"
      >
        {toast && (
          <div
            key={toast.id}
            role={toast.tone === "error" ? "alert" : undefined}
            className="pointer-events-auto flex min-h-11 max-w-md animate-reveal items-center gap-2.5 rounded-[10px] bg-zinc-900 py-1.5 pl-4 pr-1.5 text-sm text-white shadow-[0_8px_24px_rgba(24,24,27,0.2)]"
          >
            {toast.tone === "success" && <CheckIcon className="text-green-400" />}
            {toast.tone === "error" && <AlertIcon className="text-red-400" />}
            <span className="grow py-1">{toast.message}</span>
            {toast.action && (
              <button
                type="button"
                onClick={() => {
                  dismiss();
                  toast.action?.onClick();
                }}
                className="h-8 rounded-md px-2.5 font-medium text-blue-300 hover:bg-white/10"
              >
                {toast.action.label}
              </button>
            )}
            <button
              type="button"
              onClick={dismiss}
              aria-label="Dismiss"
              className="grid size-8 place-items-center rounded-md text-zinc-400 hover:bg-white/10 hover:text-white"
            >
              <XIcon size={14} />
            </button>
          </div>
        )}
      </div>
    </ToastContext>
  );
}

export const useToast = () => use(ToastContext);
