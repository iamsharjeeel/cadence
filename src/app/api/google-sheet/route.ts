import { NextResponse, type NextRequest } from "next/server";

import { getProfile } from "@/lib/auth";
import { fetchWithTimeout } from "@/lib/fetch";
import { checkRateLimit } from "@/lib/rate-limit";

const PUBLISH_HINT =
  "Make sure it's published: File → Share → Publish to web → CSV.";

const FETCH_ERROR =
  "Couldn't fetch sheet. Make sure it's published: File → Share → Publish to web → CSV.";

const MAX_CSV_BYTES = 5 * 1024 * 1024;

/**
 * Fetches a public Google Sheet as CSV, server-side (avoids browser CORS).
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
  } catch (e) {
    console.error("[google-sheet] fetch error:", e);
    return NextResponse.json(
      { error: FETCH_ERROR },
      { status: 502, headers: { "Content-Type": "application/json" } },
    );
  }

  const contentType = res.headers.get("content-type") ?? "";
  const body = await res.text();

  console.info("[google-sheet] response", {
    status: res.status,
    contentType,
    bodyLength: body.length,
    preview: body.slice(0, 500),
  });

  if (!res.ok || contentType.includes("text/html")) {
    console.error("[google-sheet] bad response", {
      status: res.status,
      contentType,
      preview: body.slice(0, 500),
    });
    return NextResponse.json(
      { error: FETCH_ERROR },
      { status: 400, headers: { "Content-Type": "application/json" } },
    );
  }

  if (body.length > MAX_CSV_BYTES) {
    return NextResponse.json(
      { error: "Sheet is too large to import (max 5MB)." },
      { status: 400, headers: { "Content-Type": "application/json" } },
    );
  }
  if (!body.trim()) {
    return NextResponse.json(
      { error: `The sheet came back empty. ${PUBLISH_HINT}` },
      { status: 400, headers: { "Content-Type": "application/json" } },
    );
  }

  return NextResponse.json(
    { csv: body },
    { headers: { "Content-Type": "application/json" } },
  );
}
