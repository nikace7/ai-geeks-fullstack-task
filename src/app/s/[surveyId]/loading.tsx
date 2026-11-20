import { LoadingLabel, Skeleton } from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <main className="mx-auto flex max-w-[680px] flex-col gap-10 px-6 pb-24 pt-12">
      <LoadingLabel>Loading survey</LoadingLabel>
      <Skeleton className="h-4 w-28" />
      <div className="flex flex-col gap-3">
        <Skeleton className="h-9 w-3/4" />
        <Skeleton className="h-5 w-full" />
      </div>
      {[0, 1, 2].map((i) => (
        <div key={i} className="flex flex-col gap-3">
          <Skeleton className="h-6 w-2/3" />
          <Skeleton className="h-[52px] w-full" />
          <Skeleton className="h-[52px] w-full" />
        </div>
      ))}
    </main>
  );
}
