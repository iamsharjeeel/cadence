import { NextRequest, NextResponse } from "next/server";

import { getProfile } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { summarizePayload } from "@/lib/audit/summarize";
import { ISO_DATE } from "@/lib/validation";

function csvEscape(value: string | number | null | undefined): string {
  const s = value === null || value === undefined ? "" : String(value);
  if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

function defaultDateRange(): { from: string; to: string } {
  const to = new Date();
  const from = new Date();
  from.setDate(from.getDate() - 30);
  return {
    from: from.toISOString().slice(0, 10),
    to: to.toISOString().slice(0, 10),
  };
}

export async function GET(request: NextRequest) {
  const profile = await getProfile();
  if (!profile || profile.status !== "active") {
    return NextResponse.json(
      { error: "Unauthorized" },
      { status: 401, headers: { "Content-Type": "application/json" } },
    );
  }
  if (profile.role !== "admin" && profile.role !== "owner" && profile.role !== "superadmin") {
    return NextResponse.json(
      { error: "Forbidden" },
      { status: 403, headers: { "Content-Type": "application/json" } },
    );
  }

  const sp = request.nextUrl.searchParams;
  const defaults = defaultDateRange();
  const fromRaw = sp.get("from")?.trim() || defaults.from;
  const toRaw = sp.get("to")?.trim() || defaults.to;
  if (!ISO_DATE.test(fromRaw) || !ISO_DATE.test(toRaw)) {
    return NextResponse.json(
      { error: "Invalid date range." },
      { status: 400, headers: { "Content-Type": "application/json" } },
    );
  }
  const from = fromRaw;
  const to = toRaw;
  const orgId =
    profile.role === "superadmin"
      ? sp.get("org") || null
      : profile.org_id;

  if ((profile.role === "admin" || profile.role === "owner") && !orgId) {
    return NextResponse.json(
      { error: "Forbidden" },
      { status: 403, headers: { "Content-Type": "application/json" } },
    );
  }

  const db = createAdminClient();

  if (orgId) {
    const { data: orgExists } = await db
      .from("organizations")
      .select("id")
      .eq("id", orgId)
      .maybeSingle();
    if (!orgExists) {
      return NextResponse.json(
        { error: "Organization not found." },
        { status: 404, headers: { "Content-Type": "application/json" } },
      );
    }
  }

  let query = db
    .from("audit_log")
    .select("created_at, action, entity, payload, org_id, actor_id")
    .order("created_at", { ascending: false })
    .limit(5000);

  if (orgId) query = query.eq("org_id", orgId);
  const actor = sp.get("actor")?.trim();
  const action = sp.get("action")?.trim();
  const entity = sp.get("entity")?.trim();
  if (actor) query = query.eq("actor_id", actor);
  if (action) query = query.eq("action", action);
  if (entity) query = query.eq("entity", entity);
  query = query
    .gte("created_at", `${from}T00:00:00Z`)
    .lte("created_at", `${to}T23:59:59Z`);

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
