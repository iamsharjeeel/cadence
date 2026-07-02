import { CardSkeleton } from "@/components/ui/Skeleton";

export default function ReportsLoading() {
  return (
    <div>
      <div className="mb-6">
        <div className="h-8 w-28 animate-pulse rounded bg-[var(--line)]" />
        <div className="mt-2 h-4 w-48 animate-pulse rounded bg-[var(--line)]" />
      </div>
      <div className="mb-4 flex gap-2">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-8 w-24 animate-pulse rounded-full bg-[var(--line)]" />
        ))}
      </div>
      <div className="grid gap-4 sm:grid-cols-3">
        <CardSkeleton bars={2} />
        <CardSkeleton bars={2} />
        <CardSkeleton bars={2} />
      </div>
      <div className="mt-4">
        <CardSkeleton bars={6} />
      </div>
    </div>
  );
}
