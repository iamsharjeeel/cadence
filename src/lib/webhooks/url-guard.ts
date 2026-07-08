import "server-only";

import { lookup } from "dns/promises";

export type UrlGuardResult = { ok: true } | { ok: false; reason: string };

/**
 * SSRF guard for outbound webhook URLs.
 *
 * Used at endpoint-creation time AND immediately before every delivery
 * attempt (including retries/cron) so that a hostname which resolved to a
 * public address at creation but is re-pointed at an internal address later
 * (DNS rebinding) is still caught.
 */
export async function validateWebhookUrl(rawUrl: string): Promise<UrlGuardResult> {
  let parsed: URL;
  try {
    parsed = new URL(rawUrl);
  } catch {
    return { ok: false, reason: "Enter a valid HTTPS URL." };
  }

  if (parsed.protocol !== "https:") {
    return { ok: false, reason: "Webhook URLs must use HTTPS." };
  }

  // URL.hostname keeps the brackets for IPv6 literals (e.g. "[::1]"); strip
  // them so both the localhost check and dns.lookup() see a bare address.
  const hostname = parsed.hostname.toLowerCase().replace(/^\[(.+)\]$/, "$1");
  if (hostname === "localhost" || hostname.endsWith(".localhost")) {
    return { ok: false, reason: "This host is not allowed for webhook delivery." };
  }

  let addresses: { address: string; family: number }[];
  try {
    addresses = await lookup(hostname, { all: true });
  } catch {
    return { ok: false, reason: "Couldn't resolve webhook host." };
  }

  if (addresses.length === 0) {
    return { ok: false, reason: "Couldn't resolve webhook host." };
  }

  for (const { address, family } of addresses) {
    const blocked = family === 6 ? isIPv6Blocked(address) : isIPv4Blocked(address);
    if (blocked) {
      return {
        ok: false,
        reason: "This host resolves to a private or restricted address.",
      };
    }
  }

  return { ok: true };
}

function isIPv4Blocked(ip: string): boolean {
  const parts = ip.split(".").map((p) => Number(p));
  if (parts.length !== 4 || parts.some((p) => !Number.isInteger(p) || p < 0 || p > 255)) {
    // Malformed / unparseable — fail closed.
    return true;
  }
  const [a, b] = parts;
  if (a === 0) return true; // 0.0.0.0/8 — unspecified / "this network"
  if (a === 127) return true; // 127.0.0.0/8 — loopback
  if (a === 10) return true; // 10.0.0.0/8 — private
  if (a === 172 && b >= 16 && b <= 31) return true; // 172.16.0.0/12 — private
  if (a === 192 && b === 168) return true; // 192.168.0.0/16 — private
  if (a === 169 && b === 254) return true; // 169.254.0.0/16 — link-local incl. cloud metadata
  if (a === 100 && b >= 64 && b <= 127) return true; // 100.64.0.0/10 — CGNAT
  return false;
}

function isIPv6Blocked(ip: string): boolean {
  const normalized = ip.toLowerCase();

  if (normalized === "::1" || normalized === "::") return true; // loopback / unspecified

  // IPv4-mapped IPv6 addresses, e.g. ::ffff:169.254.169.254
  const mapped = normalized.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/);
  if (mapped) return isIPv4Blocked(mapped[1]);

  const groups = expandIPv6(normalized);
  if (!groups) return true; // unparseable — fail closed

  const first = groups[0];
  if (first >= 0xfc00 && first <= 0xfdff) return true; // fc00::/7 — unique local
  if (first >= 0xfe80 && first <= 0xfebf) return true; // fe80::/10 — link-local

  return false;
}

/** Expands a (possibly "::"-compressed) IPv6 address into 8 numeric 16-bit groups. */
function expandIPv6(address: string): number[] | null {
  const withoutZone = address.split("%")[0];
  const parts = withoutZone.split("::");
  if (parts.length > 2) return null;

  const splitGroups = (segment: string): string[] =>
    segment.length === 0 ? [] : segment.split(":");

  const expandIPv4Tail = (groups: string[]): string[] => {
    const last = groups[groups.length - 1];
    if (!last || !last.includes(".")) return groups;
    const octets = last.split(".").map(Number);
    if (octets.length !== 4 || octets.some((o) => !Number.isInteger(o) || o < 0 || o > 255)) {
      return groups;
    }
    const hi = ((octets[0] << 8) | octets[1]).toString(16);
    const lo = ((octets[2] << 8) | octets[3]).toString(16);
    return [...groups.slice(0, -1), hi, lo];
  };

  let head = expandIPv4Tail(splitGroups(parts[0]));
  let tail = parts.length === 2 ? expandIPv4Tail(splitGroups(parts[1])) : [];

  if (parts.length === 1) {
    if (head.length !== 8) return null;
  } else {
    const missing = 8 - (head.length + tail.length);
    if (missing < 0) return null;
    head = [...head, ...new Array(missing).fill("0")];
  }

  const full = [...head, ...tail];
  if (full.length !== 8) return null;

  const parsed = full.map((g) => parseInt(g, 16));
  if (parsed.some((n) => Number.isNaN(n) || n < 0 || n > 0xffff)) return null;
  return parsed;
}
