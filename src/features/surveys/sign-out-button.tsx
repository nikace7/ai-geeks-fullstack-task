"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { Button } from "@/components/ui/button";
import { LogOutIcon } from "@/components/ui/icons";
import { useToast } from "@/components/ui/toast";
import { useAction } from "@/components/ui/use-action";
import { api } from "@/lib/api-client";

export function SignOutButton() {
  const router = useRouter();
  const toast = useToast();
  const [isLeaving, startLeaving] = useTransition();
  const { run, status } = useAction(() => api<null>("/auth/logout", { method: "POST" }));

  async function handleClick() {
    const result = await run();
    if (!result) return;
    if (!result.success) {
      toast({ message: `Couldn't sign out. ${result.error.message}`, tone: "error" });
      return;
    }
    startLeaving(() => {
      router.replace("/login");
      // Drops cached admin pages, so Back can't show them after signing out.
      router.refresh();
    });
  }

  return (
    <Button
      variant="ghost"
      size="sm"
      icon={<LogOutIcon size={14} />}
      status={isLeaving || status === "done" ? "pending" : status}
      pendingLabel="Signing out…"
      onClick={handleClick}
    >
      Sign out
    </Button>
  );
}
