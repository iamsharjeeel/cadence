import { NextResponse, type NextRequest } from "next/server";

import { getProfile } from "@/lib/auth";

const PUBLISH_HINT =
  "Make sure your sheet is published: File → Share → Publish to web → CSV.";

/**
 * Fetches a public Google Sheet as CSV, server-side (avoids browser CORS).
 * Extracts the sheet id + gid from the pasted URL and hits the CSV export
 * endpoint. Requires an active session. Never performs Google OAuth.
 */
export async function GET(request: NextRequest) {
  const profile = await getProfile();
  if (!profile || profile.status !== "active") {
    return NextResponse.json({ error: "Not authorized." }, { status: 401 });
  }

  const url = request.nextUrl.searchParams.get("url") ?? "";
  const idMatch = url.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
  if (!idMatch) {
    return NextResponse.json(
      { error: "That doesn't look like a Google Sheets link." },
      { status: 400 },
    );
  }
  const sheetId = idMatch[1];
  const gidMatch = url.match(/[#&?]gid=([0-9]+)/);
  const gid = gidMatch ? gidMatch[1] : "0";

  const exportUrl = `https://docs.google.com/spreadsheets/d/${sheetId}/export?format=csv&gid=${gid}`;

  let res: Response;
  try {
    res = await fetch(exportUrl, { redirect: "follow" });
  } catch {
    return NextResponse.json(
      { error: `Couldn't reach Google Sheets. ${PUBLISH_HINT}` },
      { status: 502 },
    );
  }

  const contentType = res.headers.get("content-type") ?? "";
  // A non-public sheet redirects to an HTML sign-in page.
  if (!res.ok || contentType.includes("text/html")) {
    return NextResponse.json(
      { error: `Couldn't read that sheet. ${PUBLISH_HINT}` },
      { status: 400 },
    );
  }

  const csv = await res.text();
  if (!csv.trim()) {
    return NextResponse.json(
      { error: `The sheet came back empty. ${PUBLISH_HINT}` },
      { status: 400 },
    );
  }

  return NextResponse.json({ csv });
}
