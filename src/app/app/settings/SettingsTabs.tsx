"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";

import { cn } from "@/lib/utils";

export function SettingsTabs() {
  const pathname = usePathname();
  const params = useSearchParams();
  const tab = params.get("tab") ?? "org";

  function href(t: string) {
    return `${pathname}?tab=${t}`;
  }

  const tabs = [
    { id: "org", label: "Organization" },
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
