"use client";

import { useEffect } from "react";
import { Logo } from "@/components/logo";
import { Button, ButtonLink } from "@/components/ui/button";
import { AlertIcon, RetryIcon } from "@/components/ui/icons";

/**
 * Shown when a page throws, instead of a blank screen. Server errors arrive without their message
 * (so nothing internal leaks), only a digest that matches the server log, shown as a reference.
 */
export default function ErrorPage({ error, retry }: { error: unknown; retry: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  const digest = error instanceof Error && "digest" in error && typeof error.digest === "string" ? error.digest : null;

  return (
    <main className="grid min-h-dvh place-items-center px-4">
      <div className="flex max-w-[420px] flex-col items-center gap-4 text-center">
        <Logo />
        <span className="mt-4 grid size-11 place-items-center rounded-[10px] bg-red-50 text-red-700">
          <AlertIcon size={20} />
        </span>
        <h1 className="text-xl font-semibold tracking-tight">Something went wrong</h1>
        <p className="text-zinc-600">
          This page didn’t load. It’s usually a brief connection problem, so trying again often works. Your saved work is safe.
        </p>
        {digest && <p className="font-mono text-xs text-zinc-500">Reference: {digest}</p>}
        <div className="flex flex-wrap justify-center gap-2">
          <Button variant="primary" size="lg" icon={<RetryIcon size={16} />} onClick={retry}>
            Try again
          </Button>
          <ButtonLink href="/surveys" size="lg">
            Go to your surveys
          </ButtonLink>
        </div>
      </div>
    </main>
  );
}
