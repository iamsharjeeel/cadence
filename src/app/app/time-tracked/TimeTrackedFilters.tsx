"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";

import { DatePicker } from "@/components/ui/DatePicker";
import { Select } from "@/components/ui/Select";
import { currentSearchParams } from "@/lib/search-params";

export type TimeWindowPreset = "this_week" | "this_month" | "custom";

export function TimeTrackedFilters({
  preset,
  project,
  from,
  to,
  projects,
}: {
  preset: TimeWindowPreset;
  project: string;
  from: string;
  to: string;
  projects: { id: string; name: string }[];
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
        label="Window"
        name="window"
        value={preset}
        onChange={(e) => {
          const nextPreset = e.target.value as TimeWindowPreset;
          setParam("window", nextPreset);
        }}
        className="h-9 w-44 text-sm"
        options={[
          { label: "This week", value: "this_week" },
          { label: "This month", value: "this_month" },
          { label: "Custom", value: "custom" },
        ]}
      />

      <Select
        label="Project"
        name="project"
        value={project}
        onChange={(e) => setParam("project", e.target.value)}
        className="h-9 w-56 text-sm"
        options={[
          { label: "All projects", value: "" },
          { label: "No project", value: "__none__" },
          ...projects.map((p) => ({ label: p.name, value: p.id })),
        ]}
      />

      {preset === "custom" ? (
        <>
          <DatePicker
            label="From"
            value={from}
            onChange={(value) => setParam("from", value)}
            className="h-9 w-40 text-sm"
          />
          <DatePicker
            label="To"
            value={to}
            onChange={(value) => setParam("to", value)}
            className="h-9 w-40 text-sm"
          />
        </>
      ) : null}
    </div>
  );
}
