"use client";

import { MotionModal } from "@/components/motion/MotionModal";
import { Button } from "@/components/ui/Button";

function SkeletonBar({ className }: { className?: string }) {
  return (
    <div
      className={`animate-pulse rounded bg-[var(--line)] ${className ?? ""}`}
    />
  );
}

export function DocumentViewModal({
  title,
  url,
  loading,
  onClose,
}: {
  title: string;
  url: string | null;
  loading: boolean;
  onClose: () => void;
}) {
  return (
    <MotionModal open={true} onClose={onClose}>
      <div className="flex max-h-[90vh] w-[min(900px,95vw)] flex-col overflow-hidden rounded-[var(--radius)] border bg-surface shadow-card">
        <div className="flex items-center justify-between border-b px-4 py-3">
          <h2 className="truncate text-sm font-medium text-ink">{title}</h2>
          <Button variant="ghost" size="sm" onClick={onClose}>
            Close
          </Button>
        </div>
        <div className="relative min-h-[60vh] flex-1 bg-[var(--line)]/30">
          {loading || !url ? (
            <div className="flex h-full min-h-[60vh] flex-col items-center justify-center gap-4 p-8">
              <svg
                className="h-8 w-8 animate-spin text-[var(--accent)]"
                viewBox="0 0 24 24"
                fill="none"
                aria-hidden
              >
                <circle
                  className="opacity-25"
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  strokeWidth="3"
                />
                <path
                  className="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 0 1 8-8V0C5.37 0 0 5.37 0 12h4z"
                />
              </svg>
              <SkeletonBar className="h-4 w-48" />
              <SkeletonBar className="h-3 w-32" />
            </div>
          ) : (
            <iframe
              src={url}
              title={title}
              className="h-full min-h-[60vh] w-full border-0"
            />
          )}
        </div>
      </div>
    </MotionModal>
  );
}
