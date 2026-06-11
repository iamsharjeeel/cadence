/** Coerce Postgres text[] / JSON / null into a string array for UI use. */
export function normalizeAllowedDomains(value: unknown): string[] {
  if (value == null) return [];
  if (Array.isArray(value)) {
    return value.map(String).map((d) => d.trim()).filter(Boolean);
  }
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (!trimmed) return [];
    // Postgres array literal: {domain1,domain2}
    if (trimmed.startsWith("{") && trimmed.endsWith("}")) {
      const inner = trimmed.slice(1, -1);
      if (!inner) return [];
      return inner
        .split(",")
        .map((d) => d.trim().replace(/^"|"$/g, ""))
        .filter(Boolean);
    }
    return trimmed
      .split(/[\s,]+/)
      .map((d) => d.trim())
      .filter(Boolean);
  }
  return [];
}

export function formatAllowedDomains(value: unknown): string {
  return normalizeAllowedDomains(value).join(", ");
}

/** Ensure any query result intended as a list is always an array. */
export function ensureArray<T>(value: T[] | null | undefined): T[] {
  return Array.isArray(value) ? value : [];
}
