"use client";

import { useToast } from "@/components/ui/toast";
import { publicSurveyUrl } from "@/lib/format";

/** Copies a survey's public link and confirms with a toast. If the browser blocks the clipboard, the toast shows the link instead. */
export function useCopyLink() {
  const toast = useToast();
  return async (surveyId: string): Promise<boolean> => {
    const url = publicSurveyUrl(surveyId);
    try {
      await navigator.clipboard.writeText(url);
      toast({ message: "Share link copied", tone: "success" });
      return true;
    } catch {
      toast({ message: `Couldn't copy automatically. The link is ${url}`, tone: "error" });
      return false;
    }
  };
}
