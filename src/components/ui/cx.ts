/** Joins class names, skipping falsy ones. ponytail: no tailwind-merge; callers don't pass conflicting classes. */
export const cx = (...classes: (string | false | null | undefined)[]) => classes.filter(Boolean).join(" ");

/** Shared text-field look, so inputs match across the builder, auth and respondent forms. */
export const fieldClasses = cx(
  "w-full rounded-lg border border-zinc-200 bg-white px-3 text-sm text-zinc-900 transition-colors",
  "placeholder:text-zinc-400 hover:border-zinc-300 focus-visible:border-blue-600 focus-visible:outline-offset-0",
  "aria-invalid:border-red-600",
);
