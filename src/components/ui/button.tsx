import Link from "next/link";
import type { ComponentProps, ReactNode } from "react";
import { cx } from "./cx";
import { CheckIcon, SpinnerIcon } from "./icons";

/** Every action moves through the same four states, so people always know whether it worked. */
export type ActionStatus = "idle" | "pending" | "done" | "error";

const VARIANTS = {
  primary: "bg-zinc-900 text-white hover:bg-zinc-700",
  secondary: "border border-zinc-200 bg-white text-zinc-900 hover:border-zinc-300 hover:bg-zinc-50",
  ghost: "text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900",
  danger: "bg-red-600 text-white hover:bg-red-700",
} as const;

const SIZES = {
  sm: "h-8 gap-1.5 rounded-md px-2.5 text-[13px]",
  md: "h-9 gap-2 rounded-lg px-3.5 text-sm",
  lg: "h-12 gap-2 rounded-[10px] px-6 text-base",
  icon: "size-8 rounded-md",
} as const;

interface StyleOptions {
  variant?: keyof typeof VARIANTS;
  size?: keyof typeof SIZES;
}

export function buttonClasses({ variant = "secondary", size = "md" }: StyleOptions = {}) {
  return cx(
    "inline-flex shrink-0 select-none items-center justify-center whitespace-nowrap font-medium transition-colors",
    VARIANTS[variant],
    SIZES[size],
  );
}

interface ButtonProps extends ComponentProps<"button">, StyleOptions {
  icon?: ReactNode;
  /** Drives the built-in feedback: spinner while pending, check and doneLabel when done. */
  status?: ActionStatus;
  pendingLabel?: string;
  doneLabel?: string;
}

export function Button({
  variant,
  size,
  icon,
  status = "idle",
  pendingLabel,
  doneLabel,
  disabled,
  className,
  children,
  type = "button",
  ...props
}: ButtonProps) {
  const isPending = status === "pending";
  const isDone = status === "done" && doneLabel !== undefined;
  const doneTint = variant === "primary" || variant === "danger" ? "text-green-400" : "text-green-600";

  return (
    <button
      type={type}
      // Disabled while pending, so a double click can't send the same request twice.
      disabled={disabled || isPending}
      aria-busy={isPending || undefined}
      className={cx(
        buttonClasses({ variant, size }),
        isPending ? "cursor-progress opacity-80" : "disabled:cursor-not-allowed disabled:opacity-45",
        className,
      )}
      {...props}
    >
      {isPending ? <SpinnerIcon /> : isDone ? <CheckIcon className={doneTint} /> : icon}
      {isPending ? (pendingLabel ?? children) : isDone ? doneLabel : children}
    </button>
  );
}

export function ButtonLink({
  variant,
  size,
  icon,
  className,
  children,
  ...props
}: ComponentProps<typeof Link> & StyleOptions & { icon?: ReactNode }) {
  return (
    <Link className={cx(buttonClasses({ variant, size }), className)} {...props}>
      {icon}
      {children}
    </Link>
  );
}
