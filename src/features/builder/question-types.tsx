import { cx } from "@/components/ui/cx";
import { MultiTypeIcon, RatingTypeIcon, SingleTypeIcon, TextTypeIcon } from "@/components/ui/icons";
import { QUESTION_TYPE_LABELS, QUESTION_TYPES, type QuestionType } from "@/core/survey-schema";

export const TYPE_META: Record<QuestionType, { hint: string; Icon: typeof TextTypeIcon }> = {
  text: { hint: "A written answer", Icon: TextTypeIcon },
  single_choice: { hint: "Pick exactly one option", Icon: SingleTypeIcon },
  multi_choice: { hint: "Pick any number of options", Icon: MultiTypeIcon },
  rating: { hint: "A score from 1 to 5", Icon: RatingTypeIcon },
};

/** The four answer types as large buttons. Used by "Add question" and the empty builder. */
export function QuestionTypePicker({ onPick, className }: { onPick: (type: QuestionType) => void; className?: string }) {
  return (
    <div className={cx("grid gap-1", className)}>
      {QUESTION_TYPES.map((type) => {
        const { hint, Icon } = TYPE_META[type];
        return (
          <button
            key={type}
            type="button"
            onClick={() => onPick(type)}
            className="flex items-center gap-3 rounded-lg p-2 text-left transition-colors hover:bg-zinc-100"
          >
            <span className="grid size-8 shrink-0 place-items-center rounded-md border border-zinc-200 bg-white text-zinc-700">
              <Icon />
            </span>
            <span className="flex flex-col">
              <span className="font-medium">{QUESTION_TYPE_LABELS[type]}</span>
              <span className="text-xs text-zinc-500">{hint}</span>
            </span>
          </button>
        );
      })}
    </div>
  );
}

/** A question's own validation messages, keyed relative to the question ("title", "options.1.label"). */
export function questionIssues(issues: Readonly<Record<string, string>>, index: number): Record<string, string> {
  const prefix = `questions.${index}.`;
  return Object.fromEntries(
    Object.entries(issues)
      .filter(([path]) => path.startsWith(prefix))
      .map(([path, message]) => [path.slice(prefix.length), message]),
  );
}
