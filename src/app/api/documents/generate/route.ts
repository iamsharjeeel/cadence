import { NextRequest, NextResponse } from "next/server";

import { getProfile } from "@/lib/auth";
import { authorizeTimesheetForDocument } from "@/lib/documents/authorization";
import { generateAndEmailDocument } from "@/lib/documents/generate";
import {
  DOCUMENT_TYPES,
  type DocumentType,
} from "@/lib/documents/types";

export async function POST(request: NextRequest) {
  const profile = await getProfile();
  if (!profile || profile.status !== "active") {
    return NextResponse.json(
      { error: "Unauthorized" },
      { status: 401, headers: { "Content-Type": "application/json" } },
    );
  }

  const contentType = request.headers.get("content-type") ?? "";
  if (!contentType.includes("application/json")) {
    return NextResponse.json(
      { error: "Expected application/json." },
      { status: 415, headers: { "Content-Type": "application/json" } },
    );
  }

  let body: {
    timesheet_id?: string;
    timesheet_ids?: string[];
    type?: string;
    gst_enabled?: boolean;
    gst_rate?: number;
  };
  try {
    body = await request.json();
  } catch {
    console.error("[documents/generate] Invalid JSON body");
    return NextResponse.json(
      { error: "Invalid JSON." },
      { status: 400, headers: { "Content-Type": "application/json" } },
    );
  }

  const type = body.type as DocumentType;
  if (!DOCUMENT_TYPES.includes(type)) {
    console.error("[documents/generate] Invalid document type:", body.type);
    return NextResponse.json(
      { error: "Invalid document type." },
      { status: 400, headers: { "Content-Type": "application/json" } },
    );
  }

  const gstEnabled = Boolean(body.gst_enabled);
  const gstRate = Number(body.gst_rate ?? 0.1);
  if (!Number.isFinite(gstRate) || gstRate < 0 || gstRate > 1) {
    console.error("[documents/generate] Invalid GST rate:", body.gst_rate);
    return NextResponse.json(
      { error: "Invalid GST rate." },
      { status: 400, headers: { "Content-Type": "application/json" } },
    );
  }

  const ids = body.timesheet_ids?.length
    ? body.timesheet_ids
    : body.timesheet_id
      ? [body.timesheet_id]
      : [];

  if (ids.length === 0) {
    console.error("[documents/generate] No timesheet ids in request");
    return NextResponse.json(
      { error: "No timesheets specified." },
      { status: 400, headers: { "Content-Type": "application/json" } },
    );
  }

  // Cap batch size: each id synchronously generates a PDF and sends an email,
  // so an unbounded array can time out the function or burn the email quota.
  const MAX_BATCH = 50;
  if (ids.length > MAX_BATCH) {
    return NextResponse.json(
      { error: `Too many timesheets — limit ${MAX_BATCH} per request.` },
      { status: 400, headers: { "Content-Type": "application/json" } },
    );
  }

  const results: {
    id: string;
    ok: boolean;
    message?: string;
    document_number?: string;
  }[] = [];

  for (const timesheetId of ids) {
    const auth = await authorizeTimesheetForDocument(profile, timesheetId);
    if (!auth.ok) {
      console.error(
        `[documents/generate] Auth failed for ${timesheetId}:`,
        auth.message,
      );
      results.push({ id: timesheetId, ok: false, message: auth.message });
      continue;
    }

    const result = await generateAndEmailDocument({
      actor: profile,
      timesheet: auth.timesheet,
      type,
      gstEnabled,
      gstRate,
    });

    if (!result.ok) {
      console.error(
        `[documents/generate] Generation failed for ${timesheetId}:`,
        result.message,
      );
    }

    results.push({
      id: timesheetId,
      ok: result.ok,
      message: result.ok ? undefined : result.message,
      document_number: result.ok ? result.documentNumber : undefined,
    });
  }

  const okCount = results.filter((r) => r.ok).length;
  if (okCount === 0) {
    const errMsg = results[0]?.message ?? "Generation failed.";
    console.error("[documents/generate] All generations failed:", results);
    return NextResponse.json(
      { error: errMsg, results },
      { status: 400, headers: { "Content-Type": "application/json" } },
    );
  }

  return NextResponse.json(
    {
      ok: true,
      message: `Generated ${okCount} document${okCount === 1 ? "" : "s"}.`,
      results,
    },
    { headers: { "Content-Type": "application/json" } },
  );
}
