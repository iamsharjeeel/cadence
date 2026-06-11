import { NextResponse, type NextRequest } from "next/server";

import { getProfile } from "@/lib/auth";
import { fetchWithTimeout } from "@/lib/fetch";
import { checkRateLimit } from "@/lib/rate-limit";

const PUBLISH_HINT =
  "Make sure your sheet is published: File → Share → Publish to web → CSV.";

const MAX_CSV_BYTES = 5 * 1024 * 1024;

/**
 * Fetches a public Google Sheet as CSV, server-side (avoids browser CORS).
 * Extracts the sheet id + gid from the pasted URL and hits the CSV export
 * endpoint. Requires an active session. Never performs Google OAuth.
 */
export async function GET(request: NextRequest) {
  const profile = await getProfile();
  if (!profile || profile.status !== "active") {
    return NextResponse.json(
      { error: "Not authorized." },
      { status: 401, headers: { "Content-Type": "application/json" } },
    );
  }

  const limit = checkRateLimit(
    `google-sheet:${profile.id}`,
    10,
    60_000,
  );
  if (!limit.ok) {
    return NextResponse.json(
      { error: "Too many requests. Try again in a minute." },
      {
        status: 429,
        headers: {
          "Content-Type": "application/json",
          "Retry-After": String(Math.ceil(limit.retryAfterMs / 1000)),
        },
      },
    );
  }

  const url = request.nextUrl.searchParams.get("url") ?? "";
  const idMatch = url.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
  if (!idMatch) {
    return NextResponse.json(
      { error: "That doesn't look like a Google Sheets link." },
      { status: 400, headers: { "Content-Type": "application/json" } },
    );
  }
  const sheetId = idMatch[1];
  const gidMatch = url.match(/[#&?]gid=([0-9]+)/);
  const gid = gidMatch ? gidMatch[1] : "0";

  const exportUrl = `https://docs.google.com/spreadsheets/d/${sheetId}/export?format=csv&gid=${gid}`;

  let res: Response;
  try {
    res = await fetchWithTimeout(exportUrl, { redirect: "follow" });
  } catch {
    return NextResponse.json(
      { error: `Couldn't reach Google Sheets. ${PUBLISH_HINT}` },
      { status: 502, headers: { "Content-Type": "application/json" } },
    );
  }

  const contentType = res.headers.get("content-type") ?? "";
  if (!res.ok || contentType.includes("text/html")) {
    return NextResponse.json(
      { error: `Couldn't read that sheet. ${PUBLISH_HINT}` },
      { status: 400, headers: { "Content-Type": "application/json" } },
    );
  }

  const csv = await res.text();
  if (csv.length > MAX_CSV_BYTES) {
    return NextResponse.json(
      { error: "Sheet is too large to import (max 5MB)." },
      { status: 400, headers: { "Content-Type": "application/json" } },
    );
  }
  if (!csv.trim()) {
    return NextResponse.json(
      { error: `The sheet came back empty. ${PUBLISH_HINT}` },
      { status: 400, headers: { "Content-Type": "application/json" } },
    );
  }

  return NextResponse.json(
    { csv },
    { headers: { "Content-Type": "application/json" } },
  );
}
