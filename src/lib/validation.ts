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
