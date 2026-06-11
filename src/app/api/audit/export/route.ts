import { NextRequest, NextResponse } from "next/server";

import { getProfile } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { summarizePayload } from "@/lib/audit/summarize";

function csvEscape(value: string | number | null | undefined): string {
  const s = value === null || value === undefined ? "" : String(value);
  if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

export async function GET(request: NextRequest) {
  const profile = await getProfile();
  if (!profile || profile.status !== "active") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (profile.role !== "admin" && profile.role !== "superadmin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const sp = request.nextUrl.searchParams;
  const orgId =
    profile.role === "superadmin"
      ? sp.get("org") || null
      : profile.org_id;

  if (profile.role === "admin" && !orgId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const db = createAdminClient();
  let query = db
    .from("audit_log")
    .select("created_at, action, entity, payload, org_id, actor_id")
    .order("created_at", { ascending: false })
    .limit(5000);

  if (orgId) query = query.eq("org_id", orgId);
  if (sp.get("actor")) query = query.eq("actor_id", sp.get("actor")!);
  if (sp.get("action")) query = query.eq("action", sp.get("action")!);
  if (sp.get("entity")) query = query.eq("entity", sp.get("entity")!);
  if (sp.get("from")) query = query.gte("created_at", `${sp.get("from")}T00:00:00Z`);
  if (sp.get("to")) query = query.lte("created_at", `${sp.get("to")}T23:59:59Z`);

  const { data: rows } = await query;
  const actorIds = [...new Set((rows ?? []).map((r) => r.actor_id).filter(Boolean))] as string[];
  const { data: actors } = actorIds.length
    ? await db.from("profiles").select("id, full_name, email, role").in("id", actorIds)
    : { data: [] };
  const actorById = new Map((actors ?? []).map((a) => [a.id, a]));

  const header = "timestamp,actor_name,actor_role,action,entity,details\n";
  const lines = (rows ?? []).map((r) => {
    const actor = r.actor_id ? actorById.get(r.actor_id) : null;
    return [
      csvEscape(r.created_at),
      csvEscape(actor?.full_name?.trim() || actor?.email),
      csvEscape(actor?.role),
      csvEscape(r.action),
      csvEscape(r.entity),
      csvEscape(summarizePayload(r.action, r.payload)),
    ].join(",");
  });

  return new NextResponse(header + lines.join("\n") + "\n", {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="cadence-audit-export.csv"`,
    },
  });
}
