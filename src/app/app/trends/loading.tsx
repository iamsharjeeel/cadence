import { CardSkeleton } from "@/components/ui/Skeleton";

export default function TrendsLoading() {
  return (
    <div>
      <div className="mb-6">
        <div className="h-8 w-28 animate-pulse rounded bg-[var(--line)]" />
        <div className="mt-2 h-4 w-56 animate-pulse rounded bg-[var(--line)]" />
      </div>
      <div className="mb-4 flex gap-2">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="h-8 w-20 animate-pulse rounded-full bg-[var(--line)]" />
        ))}
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <CardSkeleton bars={5} />
        <CardSkeleton bars={5} />
      </div>
    </div>
  );
}
