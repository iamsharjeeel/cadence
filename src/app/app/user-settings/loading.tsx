import { CardSkeleton } from "@/components/ui/Skeleton";

export default function UserSettingsLoading() {
  return (
    <div>
      <div className="mb-6">
        <div className="h-8 w-32 animate-pulse rounded bg-[var(--line)]" />
        <div className="mt-2 h-4 w-56 animate-pulse rounded bg-[var(--line)]" />
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <CardSkeleton bars={4} />
        <CardSkeleton bars={4} />
      </div>
      <div className="mt-4">
        <CardSkeleton bars={5} />
      </div>
    </div>
  );
}
