import { CardSkeleton } from "@/components/ui/Skeleton";

export default function LogTimeLoading() {
  return (
    <div>
      <div className="mb-6">
        <div className="h-8 w-32 animate-pulse rounded bg-[var(--line)]" />
        <div className="mt-2 h-4 w-80 animate-pulse rounded bg-[var(--line)]" />
      </div>
      <div className="mb-4 flex gap-2">
        <div className="h-9 w-20 animate-pulse rounded-full bg-[var(--line)]" />
        <div className="h-9 w-28 animate-pulse rounded-full bg-[var(--line)]" />
        <div className="h-9 w-24 animate-pulse rounded-full bg-[var(--line)]" />
      </div>
      <CardSkeleton bars={8} />
    </div>
  );
}
