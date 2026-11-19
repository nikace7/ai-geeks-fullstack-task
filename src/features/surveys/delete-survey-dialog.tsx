"use client";

import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { FormError } from "@/components/ui/field";
import { useAction } from "@/components/ui/use-action";
import { api } from "@/lib/api-client";
import { plural } from "@/lib/format";
import type { SurveySummary } from "@/server/surveys/service";

interface DeleteSurveyDialogProps {
  survey: SurveySummary;
  onClose: () => void;
  onDeleted: (survey: SurveySummary) => void;
}

export function DeleteSurveyDialog({ survey, onClose, onDeleted }: DeleteSurveyDialogProps) {
  const { run, status, error } = useAction(() => api<{ id: string }>(`/surveys/${survey.id}`, { method: "DELETE" }));
  const isPending = status === "pending";

  async function handleDelete() {
    const result = await run();
    if (result?.success) onDeleted(survey);
  }

  const consequence =
    survey.latestVersion === null
      ? "This draft has never been published, so no one has answered it."
      : `Its ${plural(survey.responseCount, "completed response")} and every published version go with it, and the share link stops working.`;

  return (
    <Dialog onClose={onClose} labelledBy="delete-survey-title" dismissible={!isPending}>
      <div className="flex flex-col gap-3 p-6">
        <h2 id="delete-survey-title" className="text-base font-semibold">
          Delete “{survey.title}”?
        </h2>
        <p className="text-zinc-600">
          {consequence} This can&apos;t be undone.
        </p>
        {error && <FormError>Couldn&apos;t delete the survey. {error.message} Nothing was removed.</FormError>}
      </div>
      <div className="flex justify-end gap-2 border-t border-zinc-100 bg-zinc-50 px-6 py-4">
        <Button onClick={onClose} disabled={isPending}>
          Cancel
        </Button>
        <Button variant="danger" status={status === "done" ? "pending" : status} pendingLabel="Deleting…" onClick={handleDelete}>
          {error ? "Try again" : "Delete survey"}
        </Button>
      </div>
    </Dialog>
  );
}
