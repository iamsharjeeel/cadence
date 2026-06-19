"use client";

import Link from "next/link";

import { Button } from "@/components/ui/Button";
import { DatePicker } from "@/components/ui/DatePicker";
import { Select } from "@/components/ui/Select";
import { currentSearchParams } from "@/lib/search-params";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

/** Filter bar that drives the timesheet list via URL search params. */
export function TimesheetListFilters({
  status,
  employee,
  employees,
  from,
  to,
  org,
  orgs,
  isSuperadmin,
  showEmployeeFilter,
}: {
  status: string;
  employee: string;
  employees: { id: string; name: string }[];
  from: string;
  to: string;
  org: string;
  orgs: { id: string; name: string }[];
  isSuperadmin: boolean;
  showEmployeeFilter: boolean;
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

  return (
    <div className="flex flex-wrap items-end gap-3">
      <Select
        label="Status"
        name="status"
        value={status}
        onChange={(e) => setParam("status", e.target.value)}
        className="h-9 w-40 text-sm"
        options={[
          { label: "All statuses", value: "" },
          { label: "Draft", value: "draft" },
          { label: "Submitted", value: "submitted" },
          { label: "Approved", value: "approved" },
          { label: "Rejected", value: "rejected" },
        ]}
      />
      {showEmployeeFilter && employees.length > 0 && (
        <Select
          label="Employee"
          name="employee"
          value={employee}
          onChange={(e) => setParam("employee", e.target.value)}
          className="h-9 w-52 text-sm"
          options={[
            { label: "All employees", value: "" },
            ...employees.map((e) => ({ label: e.name, value: e.id })),
          ]}
        />
      )}
      {isSuperadmin && orgs.length > 0 && (
        <Select
          label="Organization"
          name="org"
          value={org}
          onChange={(e) => setParam("org", e.target.value)}
          className="h-9 w-52 text-sm"
          options={[
            { label: "All organizations", value: "" },
            ...orgs.map((o) => ({ label: o.name, value: o.id })),
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
      <Link href="/app/timesheets/log" className="ml-auto">
        <Button size="sm">Log time</Button>
      </Link>
    </div>
  );
}
