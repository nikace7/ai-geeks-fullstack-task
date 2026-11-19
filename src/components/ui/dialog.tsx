"use client";

import { useLayoutEffect, useRef, type ReactNode } from "react";
import { cx } from "./cx";

interface DialogProps {
  onClose: () => void;
  labelledBy: string;
  /** While false (e.g. a request is in flight), Escape and backdrop clicks don't close it. */
  dismissible?: boolean;
  className?: string;
  children: ReactNode;
}

/**
 * A modal that is open while it is rendered: the parent mounts it to open and unmounts it to close.
 * The native <dialog> with showModal() gives focus trapping, Escape, an inert background and focus
 * return to the trigger for free, so there's no focus-trap library to maintain.
 */
export function Dialog({ onClose, labelledBy, dismissible = true, className, children }: DialogProps) {
  const ref = useRef<HTMLDialogElement>(null);

  useLayoutEffect(() => {
    const dialog = ref.current;
    dialog?.showModal();
    // A layout-effect cleanup runs before React removes the element, so close() can still hand
    // focus back to the button that opened the dialog.
    return () => dialog?.close();
  }, []);

  return (
    <dialog
      ref={ref}
      aria-labelledby={labelledBy}
      // The close event is queued, so it can arrive after the dialog was reopened (React's dev-mode
      // effect replay does exactly that). Only a close that left it closed means the user dismissed it.
      onClose={() => {
        if (!ref.current?.open) onClose();
      }}
      onCancel={(e) => {
        if (!dismissible) e.preventDefault();
      }}
      // The dialog element itself is only the click target when the click lands on the backdrop.
      onClick={(e) => {
        if (dismissible && e.target === ref.current) onClose();
      }}
      className={cx(
        "m-auto w-[min(480px,calc(100%-32px))] rounded-[14px] border-0 bg-white p-0 text-sm text-zinc-900",
        "shadow-[0_24px_48px_rgba(24,24,27,0.18),0_0_0_1px_rgba(24,24,27,0.06)] backdrop:bg-zinc-950/40 open:animate-reveal",
        className,
      )}
    >
      {children}
    </dialog>
  );
}
