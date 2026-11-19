"use client";

import { useRouter } from "next/navigation";
import { useTransition, type ReactNode } from "react";
import { sampleSurvey } from "@/core/sample-survey";
import { Button } from "@/components/ui/button";
import { PlusIcon } from "@/components/ui/icons";
import { useToast } from "@/components/ui/toast";
import { useAction } from "@/components/ui/use-action";
import { api } from "@/lib/api-client";
import type { SurveyDetail } from "@/server/surveys/service";

interface NewSurveyButtonProps {
  /** Start from the sample survey instead of a blank one. */
  sample?: boolean;
  variant?: "primary" | "secondary";
  children: ReactNode;
}

/** Creates the survey first, then opens it in the builder, so every survey has a URL from the start. */
export function NewSurveyButton({ sample = false, variant = "primary", children }: NewSurveyButtonProps) {
  const router = useRouter();
  const toast = useToast();
  const [isOpening, startOpening] = useTransition();
  const { run, status } = useAction(() => api<SurveyDetail>("/surveys", { body: sample ? { draft: sampleSurvey } : {} }));

  async function handleClick() {
    const result = await run();
    if (!result) return;
    if (result.success) startOpening(() => router.push(`/surveys/${result.data.id}/edit`));
    else toast({ message: `Couldn't create the survey. ${result.error.message}`, tone: "error" });
  }

  return (
    <Button
      variant={variant}
      size="lg"
      icon={sample ? undefined : <PlusIcon />}
      // Pending covers both the request and opening the builder, so the button never looks idle in between.
      status={isOpening || status === "done" ? "pending" : status}
      pendingLabel={sample ? "Copying sample…" : "Creating…"}
      onClick={handleClick}
    >
      {children}
    </Button>
  );
}
