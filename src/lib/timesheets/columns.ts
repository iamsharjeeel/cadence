import {
  CANONICAL_FIELDS,
  type CanonicalField,
  type ColumnMapping,
  type RawTable,
} from "./types";

/**
 * Header aliases for fuzzy auto-matching. Compared case-insensitively against a
 * normalized form of each incoming header (alphanumerics only).
 */
const ALIASES: Record<CanonicalField, string[]> = {
  date: ["date", "workdate", "day", "dateworked", "shiftdate", "entrydate"],
  hours: [
    "hours",
    "hrs",
    "hoursworked",
    "totalhours",
    "totalhrs",
    "duration",
    "qty",
    "quantity",
  ],
  project: ["project", "projectname", "client", "task", "job", "jobcode"],
  description: ["description", "notes", "details", "memo", "comment", "work"],
  // Specific aliases only — bare "start"/"end"/"to"/"from" false-match too easily.
  start_time: ["starttime", "timein", "clockin"],
  end_time: ["endtime", "timeout", "clockout"],
  billable: ["billable", "isbillable", "chargeable", "billed"],
};

function normalize(header: string): string {
  return header.toLowerCase().replace(/[^a-z0-9]/g, "");
}

/**
 * Auto-matches headers to canonical fields. A field is matched when a header's
 * normalized form equals or contains an alias (or vice-versa). Each header is
 * used at most once. Returns the mapping plus the set of fields confidently
 * matched so the UI can hide them.
 */
export function autoMatch(table: RawTable): {
  mapping: ColumnMapping;
  matched: Set<CanonicalField>;
} {
  const normalized = table.headers.map(normalize);
  const used = new Set<number>();
  const mapping: ColumnMapping = {
    date: null,
    hours: null,
    project: null,
    description: null,
    start_time: null,
    end_time: null,
    billable: null,
  };
  const matched = new Set<CanonicalField>();

  for (const field of CANONICAL_FIELDS) {
    const aliases = ALIASES[field];
    let bestIndex = -1;
    let bestScore = 0;

    normalized.forEach((h, i) => {
      if (used.has(i) || !h) return;
      for (const alias of aliases) {
        let score = 0;
        if (h === alias) score = 3;
        else if (h.startsWith(alias) || alias.startsWith(h)) score = 2;
        else if (h.includes(alias) || alias.includes(h)) score = 1;
        if (score > bestScore) {
          bestScore = score;
          bestIndex = i;
        }
      }
    });

    if (bestIndex >= 0) {
      mapping[field] = bestIndex;
      used.add(bestIndex);
      matched.add(field);
    }
  }

  return { mapping, matched };
}
