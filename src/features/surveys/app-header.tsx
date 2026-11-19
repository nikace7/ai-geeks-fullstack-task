import { Logo } from "@/components/logo";
import { SignOutButton } from "./sign-out-button";

export function AppHeader({ email }: { email: string }) {
  return (
    <header className="border-b border-zinc-200 bg-white">
      <div className="mx-auto flex h-14 max-w-[1200px] items-center justify-between gap-4 px-4 sm:px-6">
        <Logo />
        <div className="flex min-w-0 items-center gap-2">
          <span className="hidden truncate text-zinc-500 sm:inline">{email}</span>
          <SignOutButton />
        </div>
      </div>
    </header>
  );
}
