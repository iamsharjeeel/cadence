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
  asana_project_id?: string | null;
  asana_project_name?: string | null;
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
  asanaProjectId: string | null;
  name: string;
  color: string;
  hours: number;
  billableHours: number;
  source: "cadence" | "asana" | "none";
};

function entryGroupKey(e: PersistedEntrySlice & { id: string }): string {
  if (e.project_id) return `cadence:${e.project_id}`;
  if (e.asana_project_id) return `asana:${e.asana_project_id}`;
  return "__none__";
}

function entryDisplayName(
  e: PersistedEntrySlice,
  projects: { id: string; name: string; color: string }[],
  asanaProjects: { id: string; asana_project_name: string }[],
): { name: string; color: string; source: ProjectHoursRow["source"] } {
  if (e.project_id) {
    const project = projects.find((p) => p.id === e.project_id);
    return {
      name: project?.name ?? "No project",
      color: project?.color ?? "#6B6F76",
      source: "cadence",
    };
  }
  if (e.asana_project_id) {
    const asana =
      asanaProjects.find((p) => p.id === e.asana_project_id) ??
      (e.asana_project_name
        ? { id: e.asana_project_id, asana_project_name: e.asana_project_name }
        : null);
    return {
      name: asana?.asana_project_name ?? "No project",
      color: "#6B6F76",
      source: "asana",
    };
  }
  return { name: "No project", color: "#6B6F76", source: "none" };
}

export function groupHoursByProject(
  entries: PersistedEntrySlice[],
  projects: { id: string; name: string; color: string }[],
  asanaProjects: { id: string; asana_project_name: string }[] = [],
): ProjectHoursRow[] {
  const persisted = entries.filter(
    (e): e is PersistedEntrySlice & { id: string; total_hours: number } =>
      Boolean(e.id) && e.total_hours != null,
  );

  const map = new Map<string, ProjectHoursRow>();
  for (const e of persisted) {
    const key = entryGroupKey(e);
    const display = entryDisplayName(e, projects, asanaProjects);
    const cur = map.get(key) ?? {
      projectId: e.project_id,
      asanaProjectId: e.asana_project_id ?? null,
      name: display.name,
      color: display.color,
      hours: 0,
      billableHours: 0,
      source: display.source,
    };
    cur.hours += e.total_hours;
    if (e.billable) cur.billableHours += e.total_hours;
    map.set(key, cur);
  }

  return [...map.values()].sort((a, b) => b.hours - a.hours);
}
