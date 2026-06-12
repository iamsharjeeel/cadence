import type { Project, TimeEntry } from "@/types/db";

export type { Project, TimeEntry };

export type TimeEntryWithProject = TimeEntry & {
  project?: Pick<Project, "id" | "name" | "color"> | null;
};

export const PROJECT_PRESET_COLORS = [
  "#1F8A8A",
  "#2563EB",
  "#7C3AED",
  "#DB2777",
  "#EA580C",
  "#CA8A04",
] as const;
