import type { ReactNode } from "react";
import { AlertIcon } from "./icons";

/** A field's error, linked to its input with aria-describedby so screen readers read it on focus. */
export function FieldError({ id, children }: { id: string; children: ReactNode }) {
  return (
    <p id={id} className="flex animate-reveal items-start gap-1.5 text-[13px] leading-5 text-red-700">
      <AlertIcon size={14} className="mt-[3px] shrink-0" />
      <span>{children}</span>
    </p>
  );
}

/** A message for the whole form: wrong password, offline, rate limited. Announced as soon as it appears. */
export function FormError({ children }: { children: ReactNode }) {
  return (
    <div
      role="alert"
      className="flex animate-reveal items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2.5 text-[13px] leading-5 text-red-700"
    >
      <AlertIcon size={16} className="mt-0.5 shrink-0" />
      <span>{children}</span>
    </div>
  );
}
