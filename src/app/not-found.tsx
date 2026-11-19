import type { Metadata } from "next";
import { Logo } from "@/components/logo";
import { ButtonLink } from "@/components/ui/button";
import { SearchIcon } from "@/components/ui/icons";

export const metadata: Metadata = { title: "Not found" };

export default function NotFound() {
  return (
    <main className="grid min-h-dvh place-items-center px-4">
      <div className="flex max-w-[420px] flex-col items-center gap-4 text-center">
        <Logo />
        <span className="mt-4 grid size-11 place-items-center rounded-[10px] bg-zinc-100 text-zinc-600">
          <SearchIcon size={20} />
        </span>
        <h1 className="text-xl font-semibold tracking-tight">We couldn’t find that page</h1>
        <p className="text-zinc-600">
          The link may be mistyped, or the survey was deleted. If someone shared it with you, ask them for a new link.
        </p>
        <ButtonLink href="/surveys" variant="primary" size="lg">
          Go to your surveys
        </ButtonLink>
      </div>
    </main>
  );
}
