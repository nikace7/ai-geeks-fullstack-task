"use client";

import { Button } from "@/components/ui/button";
import { LogOutIcon } from "@/components/ui/icons";
import { useToast } from "@/components/ui/toast";
import { useAction } from "@/components/ui/use-action";
import { api } from "@/lib/api-client";

export function SignOutButton() {
  const toast = useToast();
  const { run, status } = useAction(() => api<null>("/auth/logout", { method: "POST" }));

  async function handleClick() {
    const result = await run();
    if (!result) return;
    if (!result.success) {
      toast({ message: `Couldn't sign out. ${result.error.message}`, tone: "error" });
      return;
    }
    // A full page load drops the client router's cached admin pages; router.refresh() only clears the
    // current route, so the logo link could still serve a cached dashboard after signing out.
    // eslint-disable-next-line @next/next/no-location-assign-relative-destination -- the full load is the fix
    window.location.assign("/login");
  }

  return (
    <Button
      variant="ghost"
      size="sm"
      icon={<LogOutIcon size={14} />}
      status={status === "done" ? "pending" : status}
      pendingLabel="Signing out…"
      onClick={handleClick}
    >
      Sign out
    </Button>
  );
}
