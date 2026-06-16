"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";

import { cn } from "@/lib/utils";
import { currentSearchParams } from "@/lib/search-params";

export function DocumentsTabs({
  tab = "pay",
  showOrgLibrary = false,
}: {
  tab?: string;
  showOrgLibrary?: boolean;
}) {
  const pathname = usePathname();
  const searchParams = useSearchParams();

  function href(t: string) {
    const next = currentSearchParams(searchParams);
    next.set("tab", t);
    return `${pathname}?${next.toString()}`;
  }

  const tabs = [
    { id: "pay", label: "Pay advices & invoices" },
    { id: "official", label: "Official documents" },
    ...(showOrgLibrary
      ? [{ id: "org", label: "Organization library" }]
      : []),
  ];

  return (
    <div className="mb-6 flex gap-1 border-b border-[var(--line)]">
      {tabs.map((t) => (
        <Link
          key={t.id}
          href={href(t.id)}
          className={cn(
            "-mb-px px-4 py-2 text-sm font-medium transition-colors",
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
