import { addDays, toIsoDate } from "@/lib/time/periods";
import type { TimesheetStatus } from "@/types/db";

export type EditRequestStatus = "pending" | "approved" | "rejected" | null;

export type TimesheetLifecycleStage =
  | "draft"
  | "submittable"
  | "submitted_editable"
  | "locked"
  | "approved"
  | "rejected";

export type TimesheetLifecycle = {
  stage: TimesheetLifecycleStage;
  submitOpensOn: string;
  submittedEditEndsOn: string | null;
  canSubmit: boolean;
  canEditEntries: boolean;
  canRequestEdit: boolean;
  showReminderBanner: boolean;
};

function minIsoDate(a: string, b: string): string {
  return a <= b ? a : b;
}

/**
 * Shared lifecycle resolver for timesheets.
 *
 * We intentionally keep `timesheets.status` as the single persisted state field
 * (`draft|submitted|approved|rejected`) and derive additional UI/runtime stages
 * from dates:
 * - `submittable` opens 3 days before period end.
 * - `submitted_editable` lasts for 3 days after submission or until period end.
 * - `locked` is a derived post-window stage for submitted timesheets.
 */
export function computeTimesheetLifecycle(input: {
  status: TimesheetStatus;
  periodEnd: string;
  submittedAt?: string | null;
  editRequestStatus?: EditRequestStatus;
  now?: Date;
}): TimesheetLifecycle {
  const todayIso = toIsoDate(input.now ?? new Date());
  const submitOpensOn = addDays(input.periodEnd, -3);

  if (input.status === "approved") {
    return {
      stage: "approved",
      submitOpensOn,
      submittedEditEndsOn: null,
      canSubmit: false,
      canEditEntries: false,
      canRequestEdit: false,
      showReminderBanner: false,
    };
  }
  if (input.status === "rejected") {
    return {
      stage: "rejected",
      submitOpensOn,
      submittedEditEndsOn: null,
      canSubmit: false,
      canEditEntries: true,
      canRequestEdit: false,
      showReminderBanner: false,
    };
  }

  if (input.status === "submitted") {
    const submittedDate =
      input.submittedAt && input.submittedAt.length >= 10
        ? input.submittedAt.slice(0, 10)
        : todayIso;
    const submittedEditEndsOn = minIsoDate(addDays(submittedDate, 3), input.periodEnd);
    const canEditEntries = todayIso <= submittedEditEndsOn;
    const isLocked = !canEditEntries;

    return {
      stage: isLocked ? "locked" : "submitted_editable",
      submitOpensOn,
      submittedEditEndsOn,
      canSubmit: false,
      canEditEntries,
      canRequestEdit: isLocked && input.editRequestStatus !== "pending",
      showReminderBanner: false,
    };
  }

  const canSubmit = todayIso >= submitOpensOn;
  return {
    stage: canSubmit ? "submittable" : "draft",
    submitOpensOn,
    submittedEditEndsOn: null,
    canSubmit,
    canEditEntries: true,
    canRequestEdit: false,
    showReminderBanner:
      input.status === "draft" &&
      todayIso >= submitOpensOn &&
      todayIso <= input.periodEnd,
  };
}

export function periodLengthDays(periodStart: string, periodEnd: string): number {
  const start = new Date(`${periodStart}T00:00:00Z`).getTime();
  const end = new Date(`${periodEnd}T00:00:00Z`).getTime();
  const dayMs = 86_400_000;
  return Math.floor((end - start) / dayMs) + 1;
}
