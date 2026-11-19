import { Logo } from "@/components/logo";
import { LoadingLabel, Skeleton } from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <>
      <LoadingLabel>Loading your surveys</LoadingLabel>
      <header className="border-b border-zinc-200 bg-white">
        <div className="mx-auto flex h-14 max-w-[1200px] items-center justify-between px-4 sm:px-6">
          <Logo />
          <Skeleton className="h-4 w-40" />
        </div>
      </header>
      <main className="mx-auto flex max-w-[1200px] flex-col gap-5 px-4 pb-16 pt-8 sm:px-6">
        <div className="flex items-end justify-between gap-4">
          <div className="flex flex-col gap-2">
            <Skeleton className="h-7 w-32" />
            <Skeleton className="h-4 w-80 max-w-full" />
          </div>
          <Skeleton className="h-10 w-32 rounded-lg" />
        </div>
        <div className="flex h-10 items-center gap-5 border-b border-zinc-200">
          {[48, 44, 52, 60].map((w) => (
            <Skeleton key={w} className="h-4" style={{ width: w }} />
          ))}
        </div>
        <div className="rounded-[10px] border border-zinc-200 bg-white">
          <div className="h-9" />
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="flex h-16 items-center gap-6 border-t border-zinc-100 px-4">
              <div className="flex grow flex-col gap-2">
                <Skeleton className="h-4 w-48" />
                <Skeleton className="h-3 w-24" />
              </div>
              <Skeleton className="h-5 w-16 rounded-full" />
              <Skeleton className="hidden h-4 w-40 sm:block" />
            </div>
          ))}
        </div>
      </main>
    </>
  );
}
