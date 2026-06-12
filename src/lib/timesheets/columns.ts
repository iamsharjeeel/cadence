import {
  CANONICAL_FIELDS,
  type CanonicalField,
  type ColumnMapping,
  type RawTable,
} from "./types";

/** Minimum match score to auto-map without user confirmation. */
const MIN_AUTO_MATCH_SCORE = 2;

/**
 * Header aliases for fuzzy auto-matching. Compared case-insensitively against a
 * normalized form of each incoming header (alphanumerics only).
 */
const ALIASES: Record<CanonicalField, string[]> = {
  date: ["date", "workdate", "dateworked", "shiftdate", "entrydate"],
  hours: [
    "hours",
    "hoursworked",
    "totalhours",
    "totalhrs",
    "hrs",
    "duration",
  ],
  project: ["project", "projectname", "client", "task", "job", "jobcode"],
  description: ["description", "notes", "details", "memo", "comment", "work"],
  start_time: ["starttime", "start", "timein", "clockin"],
  end_time: ["endtime", "end", "timeout", "clockout"],
  billable: ["billable", "isbillable", "chargeable", "billed"],
};

/** Fallback when no dedicated DATE column exists (e.g. DAY-only sheets). */
const DATE_DAY_ALIAS = "day";

function normalize(header: string): string {
  return header.toLowerCase().replace(/[^a-z0-9]/g, "");
}

function scoreMatch(header: string, alias: string): number {
  if (!header || !alias) return 0;
  if (header === alias) return 3;
  const minLen = Math.min(header.length, alias.length);
  if (minLen < 3) return 0;
  if (header.startsWith(alias) || alias.startsWith(header)) return 2;
  return 0;
}

function bestHeaderForAliases(
  aliases: string[],
  normalized: string[],
  used: Set<number>,
): { index: number; score: number } {
  let bestIndex = -1;
  let bestScore = 0;

  normalized.forEach((h, i) => {
    if (used.has(i) || !h) return;
    for (const alias of aliases) {
      const score = scoreMatch(h, alias);
      if (score > bestScore) {
        bestScore = score;
        bestIndex = i;
      }
    }
  });

  return { index: bestIndex, score: bestScore };
}

/**
 * Picks the date column. When both DAY and DATE headers exist, DATE wins.
 */
function matchDateColumn(
  normalized: string[],
  used: Set<number>,
): { index: number; score: number } {
  const primary = bestHeaderForAliases(ALIASES.date, normalized, used);
  if (primary.score >= MIN_AUTO_MATCH_SCORE) return primary;

  const dayOnly = bestHeaderForAliases(
    [DATE_DAY_ALIAS],
    normalized,
    used,
  );
  if (dayOnly.score >= MIN_AUTO_MATCH_SCORE) return dayOnly;

  return { index: -1, score: 0 };
}

/**
 * Auto-matches headers to canonical fields. A field is matched only when the
 * score is clearly above {@link MIN_AUTO_MATCH_SCORE}. Weak matches are left
 * unmatched so the user must pick manually.
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

  const dateMatch = matchDateColumn(normalized, used);
  if (dateMatch.index >= 0 && dateMatch.score >= MIN_AUTO_MATCH_SCORE) {
    mapping.date = dateMatch.index;
    used.add(dateMatch.index);
    matched.add("date");
  }

  for (const field of CANONICAL_FIELDS) {
    if (field === "date") continue;

    const { index, score } = bestHeaderForAliases(
      ALIASES[field],
      normalized,
      used,
    );
    if (index >= 0 && score >= MIN_AUTO_MATCH_SCORE) {
      mapping[field] = index;
      used.add(index);
      matched.add(field);
    }
  }

  return { mapping, matched };
}
