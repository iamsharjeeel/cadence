import { CardSkeleton } from "@/components/ui/Skeleton";

export default function ProfileLoading() {
  return (
    <div>
      <div className="mb-6">
        <div className="h-8 w-36 animate-pulse rounded bg-[var(--line)]" />
        <div className="mt-2 h-4 w-64 animate-pulse rounded bg-[var(--line)]" />
      </div>
      <CardSkeleton bars={2} />
      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <CardSkeleton bars={4} />
        <CardSkeleton bars={4} />
      </div>
      <div className="mt-4 space-y-4">
        <CardSkeleton bars={3} />
        <CardSkeleton bars={4} />
        <CardSkeleton bars={3} />
      </div>
    </div>
  );
}
