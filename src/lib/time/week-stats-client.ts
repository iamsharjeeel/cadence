import {
  OVERTIME_HOURS_THRESHOLD,
  SUBMIT_MIN_DAYS,
  SUBMIT_MIN_HOURS,
  type WeekStats,
} from "@/lib/time/week-constants";

export type PersistedEntrySlice = {
  id?: string;
  entry_date: string;
  total_hours?: number | null;
  billable: boolean;
  project_id: string | null;
};

export function computeWeekStatsFromPersisted(
  entries: PersistedEntrySlice[],
): WeekStats {
  const persisted = entries.filter(
    (e): e is PersistedEntrySlice & { id: string; total_hours: number } =>
      Boolean(e.id) && e.total_hours != null && !Number.isNaN(e.total_hours),
  );

  const daysLogged = new Set(persisted.map((e) => e.entry_date)).size;
  const totalHours = persisted.reduce((sum, e) => sum + e.total_hours, 0);
  const overtime =
    totalHours > OVERTIME_HOURS_THRESHOLD
      ? Math.round((totalHours - OVERTIME_HOURS_THRESHOLD) * 100) / 100
      : 0;

  return {
    daysLogged,
    totalHours,
    canSubmit: daysLogged >= SUBMIT_MIN_DAYS || totalHours >= SUBMIT_MIN_HOURS,
    overtimeHours: overtime,
  };
}

export type ProjectHoursRow = {
  projectId: string | null;
  name: string;
  color: string;
  hours: number;
  billableHours: number;
};

export function groupHoursByProject(
  entries: PersistedEntrySlice[],
  projects: { id: string; name: string; color: string }[],
): ProjectHoursRow[] {
  const persisted = entries.filter(
    (e): e is PersistedEntrySlice & { id: string; total_hours: number } =>
      Boolean(e.id) && e.total_hours != null,
  );

  const map = new Map<string, ProjectHoursRow>();
  for (const e of persisted) {
    const key = e.project_id ?? "__none__";
    const project = projects.find((p) => p.id === e.project_id);
    const cur = map.get(key) ?? {
      projectId: e.project_id,
      name: project?.name ?? "No project",
      color: project?.color ?? "#6B6F76",
      hours: 0,
      billableHours: 0,
    };
    cur.hours += e.total_hours;
    if (e.billable) cur.billableHours += e.total_hours;
    map.set(key, cur);
  }

  return [...map.values()].sort((a, b) => b.hours - a.hours);
}
