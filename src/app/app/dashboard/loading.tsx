import { CardSkeleton } from "@/components/ui/Skeleton";

export default function DashboardLoading() {
  return (
    <div>
      <div className="mb-6">
        <div className="h-8 w-56 animate-pulse rounded bg-[var(--line)]" />
        <div className="mt-2 h-4 w-72 animate-pulse rounded bg-[var(--line)]" />
      </div>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <CardSkeleton bars={2} />
        <CardSkeleton bars={2} />
        <CardSkeleton bars={2} />
      </div>
      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <CardSkeleton bars={5} />
        <CardSkeleton bars={5} />
      </div>
    </div>
  );
}
