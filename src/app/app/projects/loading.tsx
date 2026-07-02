import { CardSkeleton } from "@/components/ui/Skeleton";

export default function ProjectsLoading() {
  return (
    <div>
      <div className="mb-6 flex items-start justify-between gap-4">
        <div>
          <div className="h-8 w-32 animate-pulse rounded bg-[var(--line)]" />
          <div className="mt-2 h-4 w-72 animate-pulse rounded bg-[var(--line)]" />
        </div>
        <div className="h-9 w-28 animate-pulse rounded bg-[var(--line)]" />
      </div>
      <div className="space-y-3">
        {Array.from({ length: 5 }).map((_, i) => (
          <CardSkeleton key={i} bars={2} />
        ))}
      </div>
    </div>
  );
}
