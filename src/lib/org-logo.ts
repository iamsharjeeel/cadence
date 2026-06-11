import "server-only";

import { fetchWithTimeout } from "@/lib/fetch";

/** Fetch a public org logo and embed as base64 for @react-pdf/renderer. */
export async function resolveOrgLogoDataUrl(
  logoUrl: string | null | undefined,
): Promise<string | null> {
  if (!logoUrl?.trim()) return null;

  try {
    const res = await fetchWithTimeout(logoUrl, { timeoutMs: 10_000 });
    if (!res.ok) {
      console.error("[org-logo] fetch failed:", res.status, logoUrl);
      return null;
    }

    const contentType = res.headers.get("content-type") ?? "image/png";
    if (!contentType.startsWith("image/")) {
      console.error("[org-logo] not an image:", contentType);
      return null;
    }

    const buf = Buffer.from(await res.arrayBuffer());
    if (buf.length === 0) return null;

    return `data:${contentType.split(";")[0]};base64,${buf.toString("base64")}`;
  } catch (e) {
    console.error("[org-logo] resolve failed:", e);
    return null;
  }
}
