"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

import { Button } from "@/components/ui/Button";
import { useToast } from "@/components/ui/Toast";
import type { TimesheetStatus } from "@/types/db";
import { recallTimesheet, returnTimesheetToDraft } from "./actions";

/**
 * Status-change actions shown to the timesheet owner (or admin/superadmin):
 * - Submitted → "Recall" button → sets draft
 * - Rejected  → "Edit & resubmit" button → sets draft + navigates to log
 */
export function TimesheetStatusActions({
  id,
  status,
  periodStart,
  isOwner,
}: {
  id: string;
  status: TimesheetStatus;
  periodStart: string;
  isOwner: boolean;
}) {
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();
  const router = useRouter();

  if (!isOwner) return null;

  if (status === "submitted") {
    return (
      <Button
        type="button"
        variant="ghost"
        size="sm"
        loading={loading}
        onClick={async () => {
          setLoading(true);
          try {
            const res = await recallTimesheet(id);
            toast(res.message, res.ok ? "success" : "error");
            if (res.ok) router.refresh();
          } finally {
            setLoading(false);
          }
        }}
      >
        Recall
      </Button>
    );
  }

  if (status === "rejected") {
    return (
      <Button
        type="button"
        size="sm"
        loading={loading}
        onClick={async () => {
          setLoading(true);
          try {
            const res = await returnTimesheetToDraft(id);
            toast(res.message, res.ok ? "success" : "error");
            if (res.ok) {
              router.push(`/app/timesheets/log?week=${periodStart}`);
            }
          } finally {
            setLoading(false);
          }
        }}
      >
        Edit &amp; resubmit
      </Button>
    );
  }

  return null;
}
