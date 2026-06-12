"use client";

import { Skeleton } from "@/components/ui/Skeleton";

function DayCardSkeleton({ weekend }: { weekend?: boolean }) {
  return (
    <div
      className={`rounded-[var(--radius)] border border-[var(--line)] bg-surface p-5 ${
        weekend ? "opacity-80" : ""
      }`}
    >
      <div className="mb-4 flex items-center justify-between gap-3">
        <div className="flex flex-col gap-2">
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-3 w-16" />
        </div>
        <Skeleton className="h-8 w-20 rounded-[var(--radius)]" />
      </div>
      <div className="flex flex-col gap-3">
        <Skeleton className="h-[4.5rem] w-full rounded-[calc(var(--radius)-4px)]" />
        <Skeleton className="h-[4.5rem] w-full rounded-[calc(var(--radius)-4px)]" />
      </div>
    </div>
  );
}

export function LogWeekSkeleton() {
  return (
    <>
      {Array.from({ length: 7 }).map((_, i) => (
        <DayCardSkeleton key={i} weekend={i >= 5} />
      ))}
    </>
  );
}

export function LogSummarySkeleton() {
  return (
    <div className="flex flex-col gap-5">
      <Skeleton className="h-5 w-32" />
      <div className="border-b border-[var(--line)] pb-4">
        <Skeleton className="mb-2 h-3 w-20" />
        <Skeleton className="h-9 w-16" />
      </div>
      <div className="flex flex-col gap-3">
        <Skeleton className="h-3 w-24" />
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-4/5" />
      </div>
      <div className="grid grid-cols-2 gap-4 border-t border-[var(--line)] pt-4">
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-10 w-full" />
      </div>
      <Skeleton className="h-11 w-full rounded-[var(--radius)]" />
    </div>
  );
}
