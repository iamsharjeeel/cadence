/**
 * Tiny className combiner. Filters falsy values and joins with a space.
 * Kept dependency-free to avoid pulling clsx/tailwind-merge for Phase 1.
 */
export function cn(
  ...classes: Array<string | false | null | undefined>
): string {
  return classes.filter(Boolean).join(" ");
}

/** Title-cases an enum-ish token, e.g. "biweekly" → "Biweekly". */
export function titleCase(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

/**
 * Human-readable role label for display. The DB enum value 'admin' is never
 * shown directly — it maps to "Manager". 'owner' shows as "Owner" (gold badge).
 */
export function roleLabel(role: string): string {
  if (role === "admin") return "Manager";
  if (role === "owner") return "Owner";
  return titleCase(role);
}

/** Formats a money value with tabular-friendly output. */
export function formatMoney(
  amount: number | null | undefined,
  currency = "USD",
): string {
  if (amount === null || amount === undefined) return "—";
  try {
    return new Intl.NumberFormat(undefined, {
      style: "currency",
      currency,
      maximumFractionDigits: 2,
    }).format(amount);
  } catch {
    // Unknown currency code — fall back to a plain number with the code.
    return `${amount.toFixed(2)} ${currency}`;
  }
}

/** Formats an ISO timestamp as a short, readable date. */
export function formatDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return new Intl.DateTimeFormat(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  }).format(d);
}

/** Extracts the lowercased domain from an email address, or null. */
export function emailDomain(email: string | null | undefined): string | null {
  if (!email) return null;
  const at = email.lastIndexOf("@");
  if (at === -1) return null;
  const domain = email.slice(at + 1).trim().toLowerCase();
  return domain || null;
}

/** Builds initials for an avatar fallback. */
export function initials(name: string | null, email: string): string {
  const source = name?.trim() || email;
  const parts = source.split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}
