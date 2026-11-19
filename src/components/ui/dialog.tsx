"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { cx } from "./cx";

interface DialogProps {
  open: boolean;
  onClose: () => void;
  labelledBy: string;
  /** While false (e.g. a request is in flight), Escape and backdrop clicks don't close it. */
  dismissible?: boolean;
  className?: string;
  children: ReactNode;
}

/**
 * The native <dialog> element: showModal() gives focus trapping, Escape to close, inert background
 * and focus return for free, so there's no focus-trap library to maintain.
 */
export function Dialog({ open, onClose, labelledBy, dismissible = true, className, children }: DialogProps) {
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      aria-labelledby={labelledBy}
      onClose={onClose}
      onCancel={(e) => {
        if (!dismissible) e.preventDefault();
      }}
      // The dialog element itself is only the click target when the click lands on the backdrop.
      onClick={(e) => {
        if (dismissible && e.target === ref.current) onClose();
      }}
      className={cx(
        "m-auto w-[min(520px,calc(100%-32px))] rounded-[14px] border-0 bg-white p-0 text-zinc-900",
        "shadow-[0_24px_48px_rgba(24,24,27,0.18),0_0_0_1px_rgba(24,24,27,0.06)] backdrop:bg-zinc-950/40 open:animate-reveal",
        className,
      )}
    >
      {open && children}
    </dialog>
  );
}
