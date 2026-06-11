"use client";

import { useRouter, usePathname, useSearchParams } from "next/navigation";

import { Select } from "@/components/ui/Select";
import { currentSearchParams } from "@/lib/search-params";

export function LeaveOrgSelect({
  orgs,
  selectedOrgId,
}: {
  orgs: { id: string; name: string }[];
  selectedOrgId: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  function onChange(orgId: string) {
    const next = currentSearchParams(searchParams);
    if (orgId) next.set("org", orgId);
    else next.delete("org");
    router.replace(`${pathname}?${next.toString()}`);
  }

  return (
    <Select
      label="Organization"
      value={selectedOrgId}
      onChange={(e) => onChange(e.target.value)}
      className="h-10 max-w-md text-sm"
      options={orgs.map((o) => ({ label: o.name, value: o.id }))}
    />
  );
}
