"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";

import { cn } from "@/lib/utils";
import { currentSearchParams } from "@/lib/search-params";

export function SettingsTabs({
  tab,
  isSuperadmin = false,
}: {
  tab: string;
  isSuperadmin?: boolean;
}) {
  const pathname = usePathname();
  const searchParams = useSearchParams();

  function href(t: string) {
    const next = currentSearchParams(searchParams);
    next.set("tab", t);
    return `${pathname}?${next.toString()}`;
  }

  const tabs = [
    { id: "general", label: "General" },
    { id: "leave", label: "Leave types" },
  ];

  return (
    <div className="mb-6 flex gap-1 border-b">
      {tabs.map((t) => (
        <Link
          key={t.id}
          href={href(t.id)}
          className={cn(
            "px-4 py-2 text-sm font-medium transition-colors",
            tab === t.id
              ? "border-b-2 border-[var(--accent)] text-[var(--accent-strong)]"
              : "text-muted hover:text-ink",
          )}
        >
          {t.label}
        </Link>
      ))}
    </div>
  );
}
