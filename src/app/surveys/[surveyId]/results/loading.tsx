import { LoadingLabel, Skeleton } from "@/components/ui/skeleton";

/** Mirrors the results header, summary row and first question cards. */
export default function Loading() {
  return (
    <>
      <LoadingLabel>Loading results</LoadingLabel>
      <header className="border-b border-zinc-200 bg-white">
        <div className="mx-auto flex h-14 max-w-[1200px] items-center gap-3 px-4 sm:px-6">
          <Skeleton className="h-4 w-20" />
          <Skeleton className="hidden h-4 w-48 sm:block" />
          <Skeleton className="h-[22px] w-16 rounded-full" />
          <div className="grow" />
          <Skeleton className="hidden h-9 w-28 rounded-lg sm:block" />
          <Skeleton className="h-9 w-28 rounded-lg" />
        </div>
      </header>
      <main className="mx-auto flex max-w-[1200px] flex-col gap-6 px-4 pb-16 pt-8 sm:px-6">
        <div className="flex flex-col gap-2">
          <Skeleton className="h-7 w-28" />
          <Skeleton className="h-4 w-full max-w-[480px]" />
        </div>
        <Skeleton className="h-[200px] w-full rounded-xl lg:h-[106px]" />
        <Skeleton className="h-48 w-full rounded-xl" />
        <Skeleton className="h-64 w-full rounded-xl" />
      </main>
    </>
  );
}
