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
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
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
    return NextResponse.json({ error: "Invalid JSON." }, { status: 400 });
  }

  const type = body.type as DocumentType;
  if (!DOCUMENT_TYPES.includes(type)) {
    return NextResponse.json({ error: "Invalid document type." }, { status: 400 });
  }

  const gstEnabled = Boolean(body.gst_enabled);
  const gstRate = Number(body.gst_rate ?? 0.1);
  if (!Number.isFinite(gstRate) || gstRate < 0 || gstRate > 1) {
    return NextResponse.json({ error: "Invalid GST rate." }, { status: 400 });
  }

  const ids = body.timesheet_ids?.length
    ? body.timesheet_ids
    : body.timesheet_id
      ? [body.timesheet_id]
      : [];

  if (ids.length === 0) {
    return NextResponse.json(
      { error: "No timesheets specified." },
      { status: 400 },
    );
  }

  const results: { id: string; ok: boolean; message?: string; document_number?: string }[] = [];

  for (const timesheetId of ids) {
    const auth = await authorizeTimesheetForDocument(profile, timesheetId);
    if (!auth.ok) {
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

    results.push({
      id: timesheetId,
      ok: result.ok,
      message: result.ok ? undefined : result.message,
      document_number: result.ok ? result.documentNumber : undefined,
    });
  }

  const okCount = results.filter((r) => r.ok).length;
  if (okCount === 0) {
    return NextResponse.json(
      { error: results[0]?.message ?? "Generation failed.", results },
      { status: 400 },
    );
  }

  return NextResponse.json({
    ok: true,
    message: `Generated ${okCount} document${okCount === 1 ? "" : "s"}.`,
    results,
  });
}
