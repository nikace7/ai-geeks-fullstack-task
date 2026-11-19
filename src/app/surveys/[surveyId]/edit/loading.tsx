import { LoadingLabel, Skeleton } from "@/components/ui/skeleton";

/** Mirrors the builder's header and three columns, so nothing jumps when the survey arrives. */
export default function Loading() {
  return (
    <>
      <LoadingLabel>Loading the survey builder</LoadingLabel>
      <header className="border-b border-zinc-200 bg-white">
        <div className="flex h-14 items-center gap-3 px-4 sm:px-6">
          <Skeleton className="h-4 w-20" />
          <Skeleton className="hidden h-4 w-48 sm:block" />
          <Skeleton className="h-[22px] w-16 rounded-full" />
          <div className="grow" />
          <Skeleton className="hidden h-4 w-32 sm:block" />
          <Skeleton className="h-9 w-24 rounded-lg" />
        </div>
      </header>
      <div className="grid grid-cols-[minmax(0,1fr)] md:grid-cols-[280px_minmax(0,1fr)] lg:grid-cols-[280px_minmax(0,1fr)_320px] xl:grid-cols-[300px_minmax(0,1fr)_360px]">
        <div className="hidden flex-col gap-3 border-r border-zinc-200 bg-white px-4 py-5 md:flex md:h-[calc(100dvh-3.5rem)]">
          <Skeleton className="h-3 w-20" />
          <Skeleton className="h-9 w-full rounded-lg" />
          <Skeleton className="h-20 w-full rounded-lg" />
          {[0, 1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-9 w-full rounded-lg" />
          ))}
        </div>
        <div className="flex justify-center px-4 py-6 sm:px-8">
          <div className="flex w-full max-w-[640px] flex-col gap-4">
            <Skeleton className="h-5 w-40" />
            <Skeleton className="h-72 w-full rounded-xl" />
            <Skeleton className="h-32 w-full rounded-xl" />
          </div>
        </div>
        <div className="hidden flex-col gap-4 border-l border-zinc-200 px-4 py-5 lg:flex">
          <Skeleton className="h-3 w-24" />
          <Skeleton className="h-24 w-full rounded-xl" />
          <Skeleton className="h-40 w-full rounded-xl" />
        </div>
      </div>
    </>
  );
}
