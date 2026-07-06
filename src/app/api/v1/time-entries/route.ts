import { NextRequest } from "next/server";

import { validateApiKey } from "@/lib/api-auth";
import {
  apiForbidden,
  apiJson,
  apiUnauthorized,
  apiValidationError,
} from "@/lib/api/v1/response";
import { enforceApiRateLimit, requireWritePermission } from "@/lib/api/v1/guard";
import { createAdminClient } from "@/lib/supabase/admin";
import { syntheticTimesForDecimalHours } from "@/lib/time/decimal-hours";
import type { TimeEntry } from "@/types/db";

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 200;

function parseLimit(raw: string | null): number {
  const n = Number(raw ?? DEFAULT_LIMIT);
  if (!Number.isFinite(n) || n < 1) return DEFAULT_LIMIT;
  return Math.min(Math.floor(n), MAX_LIMIT);
}

function parseOffset(raw: string | null): number {
  const n = Number(raw ?? 0);
  if (!Number.isFinite(n) || n < 0) return 0;
  return Math.floor(n);
}

export async function GET(request: NextRequest) {
  const ctx = await validateApiKey(request);
  if (!ctx) return apiUnauthorized();
  const limited = enforceApiRateLimit(ctx);
  if (limited) return limited;

  const params = request.nextUrl.searchParams;
  const from = params.get("from") ?? "";
  const to = params.get("to") ?? "";
  const projectId = params.get("project_id");
  const limit = parseLimit(params.get("limit"));
  const offset = parseOffset(params.get("offset"));

  if (from && !ISO_DATE.test(from)) {
    return apiValidationError({ from: "Must be ISO date YYYY-MM-DD" });
  }
  if (to && !ISO_DATE.test(to)) {
    return apiValidationError({ to: "Must be ISO date YYYY-MM-DD" });
  }
  if (from && to && from > to) {
    return apiValidationError({ to: "Must be on or after from date" });
  }

  const db = createAdminClient();
  let query = db
    .from("time_entries")
    .select("*", { count: "exact" })
    .order("entry_date", { ascending: false })
    .order("created_at", { ascending: false });

  if (ctx.orgId) {
    query = query.eq("org_id", ctx.orgId);
  } else {
    query = query.eq("employee_id", ctx.userId).is("org_id", null);
  }

  if (from) query = query.gte("entry_date", from);
  if (to) query = query.lte("entry_date", to);
  if (projectId) query = query.eq("project_id", projectId);

  const { data, count, error } = await query.range(offset, offset + limit - 1);
  if (error) {
    console.error("[api/v1/time-entries] GET failed:", error.message);
    return apiJson({ error: "Internal error" }, 500);
  }

  return apiJson({
    data: (data ?? []) as TimeEntry[],
    total: count ?? 0,
    limit,
    offset,
  });
}

export async function POST(request: NextRequest) {
  const ctx = await validateApiKey(request);
  if (!ctx) return apiUnauthorized();
  const limited = enforceApiRateLimit(ctx);
  if (limited) return limited;
  const writeGate = requireWritePermission(ctx);
  if (writeGate) return writeGate;

  let body: {
    date?: string;
    hours?: number;
    description?: string;
    project_id?: string;
    billable?: boolean;
  };

  try {
    body = await request.json();
  } catch {
    return apiValidationError({ body: "Invalid JSON" });
  }

  const date = body.date ?? "";
  const hours = Number(body.hours);

  if (!ISO_DATE.test(date)) {
    return apiValidationError({ date: "Required ISO date YYYY-MM-DD" });
  }
  if (!Number.isFinite(hours) || hours <= 0 || hours > 24) {
    return apiValidationError({ hours: "Must be greater than 0 and at most 24" });
  }

  const db = createAdminClient();
  const projectId = body.project_id?.trim() || null;

  if (projectId) {
    let projectQuery = db.from("projects").select("id").eq("id", projectId);
    if (ctx.orgId) {
      projectQuery = projectQuery.eq("org_id", ctx.orgId);
    } else {
      projectQuery = projectQuery
        .eq("owner_id", ctx.userId)
        .is("org_id", null);
    }
    const { data: project } = await projectQuery.maybeSingle();
    if (!project) {
      return apiValidationError({ project_id: "Project not found in this scope" });
    }
  }

  const roundedHours = Math.round(hours * 100) / 100;
  const synthetic = syntheticTimesForDecimalHours(roundedHours);

  const { data, error } = await db
    .from("time_entries")
    .insert({
      org_id: ctx.orgId,
      employee_id: ctx.userId,
      entry_date: date,
      start_time: synthetic.start_time,
      end_time: synthetic.end_time,
      entry_mode: "decimal_hours",
      decimal_hours: roundedHours,
      description: body.description?.trim() || null,
      billable: body.billable ?? true,
      project_id: projectId,
    })
    .select("*")
    .single();

  if (error || !data) {
    console.error("[api/v1/time-entries] POST failed:", error?.message);
    return apiJson({ error: "Internal error" }, 500);
  }

  return apiJson({ data: data as TimeEntry }, 201);
}
