"use client";

import { useRouter, usePathname, useSearchParams } from "next/navigation";

import { Select } from "@/components/ui/Select";
import { DatePicker } from "@/components/ui/DatePicker";
import { DOCUMENT_STATUSES } from "@/lib/documents/types";
import { currentSearchParams } from "@/lib/search-params";

export function DocumentFilters({
  type,
  status,
  employee,
  employees,
  from,
  to,
  isManager,
}: {
  type: string;
  status: string;
  employee: string;
  employees: { id: string; name: string }[];
  from: string;
  to: string;
  isManager: boolean;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  function setParam(key: string, value: string) {
    const next = currentSearchParams(searchParams);
    if (value) next.set(key, value);
    else next.delete(key);
    router.replace(`${pathname}?${next.toString()}`);
  }

  if (!isManager) return null;

  return (
    <div className="flex flex-wrap items-end gap-3">
      <Select
        label="Type"
        value={type}
        onChange={(e) => setParam("type", e.target.value)}
        className="h-9 w-40 text-sm"
        options={[
          { label: "All types", value: "" },
          { label: "Pay Advice", value: "pay_advice" },
          { label: "Invoice", value: "invoice" },
        ]}
      />
      <Select
        label="Status"
        value={status}
        onChange={(e) => setParam("status", e.target.value)}
        className="h-9 w-44 text-sm"
        options={[
          { label: "All statuses", value: "" },
          ...DOCUMENT_STATUSES.map((s) => ({
            label: s.replace(/_/g, " "),
            value: s,
          })),
        ]}
      />
      {employees.length > 0 && (
        <Select
          label="Employee"
          value={employee}
          onChange={(e) => setParam("employee", e.target.value)}
          className="h-9 w-52 text-sm"
          options={[
            { label: "All employees", value: "" },
            ...employees.map((e) => ({ label: e.name, value: e.id })),
          ]}
        />
      )}
      <DatePicker
        label="From"
        value={from}
        onChange={(v) => setParam("from", v)}
        className="h-9 w-40 text-sm"
      />
      <DatePicker
        label="To"
        value={to}
        onChange={(v) => setParam("to", v)}
        className="h-9 w-40 text-sm"
      />
    </div>
  );
}
