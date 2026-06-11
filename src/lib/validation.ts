/**
 * Server-side validation helpers. These run inside Server Actions and Route
 * Handlers — never trust the client to have validated anything.
 */

const SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
// Conservative domain matcher: labels of alphanumerics/hyphens, a dot, and a TLD.
const DOMAIN_RE =
  /^(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,}$/;

export type Validated<T> =
  | { ok: true; value: T }
  | { ok: false; error: string };

/** Normalizes a free-text name into a URL-safe slug. */
export function slugify(input: string): string {
  return input
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function validateSlug(input: string): Validated<string> {
  const slug = input.trim().toLowerCase();
  if (!slug) return { ok: false, error: "Slug is required." };
  if (slug.length < 2 || slug.length > 48)
    return { ok: false, error: "Slug must be 2–48 characters." };
  if (!SLUG_RE.test(slug))
    return {
      ok: false,
      error: "Slug may only contain lowercase letters, numbers, and hyphens.",
    };
  return { ok: true, value: slug };
}

export function validateOrgName(input: string): Validated<string> {
  const name = input.trim();
  if (!name) return { ok: false, error: "Organization name is required." };
  if (name.length > 80)
    return { ok: false, error: "Name must be 80 characters or fewer." };
  return { ok: true, value: name };
}

/**
 * Parses a comma/space/newline-separated list of domains, lowercases and
 * de-duplicates them, and validates each. Returns the cleaned array.
 */
export function validateDomains(input: string): Validated<string[]> {
  const raw = input
    .split(/[\s,]+/)
    .map((d) => d.trim().toLowerCase())
    .filter(Boolean);

  const seen = new Set<string>();
  const domains: string[] = [];
  for (const d of raw) {
    const domain = d.startsWith("@") ? d.slice(1) : d;
    if (!DOMAIN_RE.test(domain)) {
      return { ok: false, error: `"${d}" is not a valid domain.` };
    }
    if (!seen.has(domain)) {
      seen.add(domain);
      domains.push(domain);
    }
  }
  return { ok: true, value: domains };
}

export function validateCurrency(input: string): Validated<string> {
  const code = input.trim().toUpperCase();
  if (!/^[A-Z]{3}$/.test(code))
    return { ok: false, error: "Currency must be a 3-letter ISO code." };
  return { ok: true, value: code };
}

export function validateRate(input: string): Validated<number | null> {
  const trimmed = input.trim();
  if (trimmed === "") return { ok: true, value: null };
  const n = Number(trimmed);
  if (!Number.isFinite(n) || n < 0)
    return { ok: false, error: "Rate must be a non-negative number." };
  return { ok: true, value: Math.round(n * 100) / 100 };
}

export const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

export function validateIsoDate(
  input: string,
  label = "Date",
): Validated<string> {
  const trimmed = input.trim();
  if (!trimmed) return { ok: false, error: `${label} is required.` };
  if (!ISO_DATE.test(trimmed))
    return { ok: false, error: `${label} must be YYYY-MM-DD.` };
  const parsed = new Date(`${trimmed}T12:00:00Z`);
  if (Number.isNaN(parsed.getTime()))
    return { ok: false, error: `${label} is invalid.` };
  return { ok: true, value: trimmed };
}

export function validateDateRange(
  start: string,
  end: string,
): Validated<{ start: string; end: string }> {
  const startV = validateIsoDate(start, "Start date");
  if (!startV.ok) return startV;
  const endV = validateIsoDate(end, "End date");
  if (!endV.ok) return endV;
  if (startV.value > endV.value) {
    return { ok: false, error: "Start date must be on or before end date." };
  }
  const minYear = 2000;
  const maxYear = new Date().getFullYear() + 2;
  for (const d of [startV.value, endV.value]) {
    const y = parseInt(d.slice(0, 4), 10);
    if (y < minYear || y > maxYear) {
      return { ok: false, error: "Date is out of allowed range." };
    }
  }
  return { ok: true, value: { start: startV.value, end: endV.value } };
}

export function validateMaxLength(
  input: string,
  max: number,
  label: string,
): Validated<string> {
  const trimmed = input.trim();
  if (trimmed.length > max) {
    return { ok: false, error: `${label} must be ${max} characters or fewer.` };
  }
  return { ok: true, value: trimmed };
}

export function validateEnum<T extends string>(
  input: string,
  allowed: readonly T[],
  label: string,
): Validated<T> {
  if (!allowed.includes(input as T)) {
    return { ok: false, error: `Invalid ${label}.` };
  }
  return { ok: true, value: input as T };
}

export function validateYear(input: number): Validated<number> {
  const y = Math.floor(input);
  const current = new Date().getFullYear();
  if (!Number.isFinite(y) || y < current - 1 || y > current + 2) {
    return { ok: false, error: "Invalid year." };
  }
  return { ok: true, value: y };
}

export function validateNonNegativeNumber(
  input: number,
  label: string,
): Validated<number> {
  if (!Number.isFinite(input) || input < 0) {
    return { ok: false, error: `${label} must be a non-negative number.` };
  }
  return { ok: true, value: input };
}
