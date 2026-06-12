"use client";

import Link from "next/link";

import { Button } from "@/components/ui/Button";
import { ExportButton } from "./ExportButton";

export function TimesheetPageActions({
  showExport,
  showLogTime,
}: {
  showExport?: boolean;
  showLogTime?: boolean;
}) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      {showLogTime && (
        <Link href="/app/timesheets/log">
          <Button size="sm">Log my time</Button>
        </Link>
      )}
      {showExport && <ExportButton />}
    </div>
  );
}
