import type {
  AsanaImportedProject,
  Project,
  TimeEntry,
  TimesheetStatus,
} from "@/types/db";
import type { PayPeriod } from "@/lib/time/periods";
import type { WeekStats } from "@/lib/time/week-constants";

export type { Project, TimeEntry };

export type LinkedEmailThreadMeta = {
  linkId: string;
  threadId: string;
  gmailThreadId: string;
  subject: string | null;
  gmailPermalink: string | null;
};

export type TimeEntryWithProject = TimeEntry & {
  project?: Pick<Project, "id" | "name" | "color"> | null;
  asana_project?: Pick<
    AsanaImportedProject,
    "id" | "asana_project_name" | "asana_project_gid"
  > | null;
  asana_project_name?: string | null;
  linked_email_threads?: LinkedEmailThreadMeta[];
};

export type TimeTrackingData = {
  ok: true;
  timesheetId: string;
  orgId: string | null;
  employeeId: string;
  status: TimesheetStatus;
  submittedAt: string | null;
  entries: TimeEntryWithProject[];
  projects: Project[];
  asanaConnected: boolean;
  asanaImportedProjects: AsanaImportedProject[];
  asanaProjectNamesSyncedAt: string | null;
  gmailConnected: boolean;
  week: PayPeriod;
  isoWeek: string;
  weekStats: WeekStats;
  rate: number | null;
  rateType: string;
  currency: string | null;
};

export const PROJECT_PRESET_COLORS = [
  "#B8862F",
  "#2563EB",
  "#7C3AED",
  "#DB2777",
  "#EA580C",
] as const;
