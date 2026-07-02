import { CardSkeleton } from "@/components/ui/Skeleton";

export default function SettingsLoading() {
  return (
    <div>
      <div className="mb-6">
        <div className="h-8 w-48 animate-pulse rounded bg-[var(--line)]" />
        <div className="mt-2 h-4 w-72 animate-pulse rounded bg-[var(--line)]" />
      </div>
      <div className="mb-4 flex gap-2">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-9 w-24 animate-pulse rounded-full bg-[var(--line)]" />
        ))}
      </div>
      <CardSkeleton bars={6} />
    </div>
  );
}
