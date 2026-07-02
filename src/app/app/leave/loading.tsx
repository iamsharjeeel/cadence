import { CardSkeleton } from "@/components/ui/Skeleton";

export default function LeaveLoading() {
  return (
    <div>
      <div className="mb-6">
        <div className="h-8 w-24 animate-pulse rounded bg-[var(--line)]" />
        <div className="mt-2 h-4 w-56 animate-pulse rounded bg-[var(--line)]" />
      </div>
      <CardSkeleton bars={1} />
      <div className="mt-4 grid grid-cols-7 gap-px rounded-[var(--radius-card)] border bg-[var(--line)] p-px">
        {Array.from({ length: 35 }).map((_, i) => (
          <div key={i} className="min-h-[72px] animate-pulse bg-surface" />
        ))}
      </div>
      <div className="mt-4">
        <CardSkeleton bars={4} />
      </div>
    </div>
  );
}
