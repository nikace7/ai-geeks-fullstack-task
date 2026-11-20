import type { ReactNode, Ref } from "react";
import { cx } from "@/components/ui/cx";
import { LockIcon, SearchIcon } from "@/components/ui/icons";

const TONES = {
  success: "bg-green-50 text-green-700",
  neutral: "bg-zinc-100 text-zinc-600",
} as const;

interface FormEndStateProps {
  icon: ReactNode;
  tone?: keyof typeof TONES;
  title: string;
  children: ReactNode;
  action?: ReactNode;
  /** Set when the message replaces the form in place, so focus moves to it and it gets read out. */
  headingRef?: Ref<HTMLHeadingElement>;
}

/**
 * A full-page message where the form would be: submitted, already responded, closed, not found.
 * Plain markup, so the server page and the client form render the same thing.
 */
export function FormEndState({ icon, tone = "neutral", title, children, action, headingRef }: FormEndStateProps) {
  return (
    <main className="grid min-h-dvh place-items-center px-6 py-16">
      <div className="flex max-w-[460px] animate-reveal flex-col items-center gap-3 text-center">
        <span className={cx("mb-2 grid size-12 place-items-center rounded-full", TONES[tone])}>{icon}</span>
        <h1 ref={headingRef} tabIndex={-1} className="text-2xl font-semibold tracking-tight outline-none">
          {title}
        </h1>
        <p className="text-base leading-[26px] text-zinc-600">{children}</p>
        {action && <div className="mt-3">{action}</div>}
      </div>
    </main>
  );
}

type SharedStateProps = Pick<FormEndStateProps, "headingRef">;

export function SurveyClosed({ title, headingRef }: SharedStateProps & { title: string }) {
  return (
    <FormEndState icon={<LockIcon size={22} />} title="This survey is closed" headingRef={headingRef}>
      “{title}” isn’t taking responses anymore. Thanks for stopping by.
    </FormEndState>
  );
}

export function SurveyNotFound({ headingRef }: SharedStateProps) {
  return (
    <FormEndState icon={<SearchIcon size={22} />} title="We couldn’t find this survey" headingRef={headingRef}>
      The link may be incomplete, or the survey was deleted. Check the link with whoever sent it.
    </FormEndState>
  );
}
