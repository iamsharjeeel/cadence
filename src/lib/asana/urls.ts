/** Opens the Asana project in the web app (gid from asana_imported_projects.asana_project_gid). */
export function asanaProjectUrl(gid: string): string {
  return `https://app.asana.com/0/${gid}`;
}

export function formatAsanaSyncedAt(iso: string | null): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}
