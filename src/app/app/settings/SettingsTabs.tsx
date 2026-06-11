"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";

import { cn } from "@/lib/utils";

export function SettingsTabs({ isSuperadmin = false }: { isSuperadmin?: boolean }) {
  const pathname = usePathname();
  const params = useSearchParams();
  const tab = params.get("tab") ?? "general";

  function href(t: string) {
    const next = new URLSearchParams(params.toString());
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
