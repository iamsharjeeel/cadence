import { NextRequest } from "next/server";

import { validateApiKey } from "@/lib/api-auth";
import { enforceApiRateLimit } from "@/lib/api/v1/guard";
import { apiJson, apiUnauthorized } from "@/lib/api/v1/response";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Project } from "@/types/db";

export async function GET(request: NextRequest) {
  const ctx = await validateApiKey(request);
  if (!ctx) return apiUnauthorized();
  const limited = enforceApiRateLimit(ctx);
  if (limited) return limited;

  const db = createAdminClient();
  let query = db
    .from("projects")
    .select("*")
    .eq("is_active", true)
    .order("name");

  if (ctx.orgId) {
    query = query.eq("org_id", ctx.orgId);
  } else {
    query = query.eq("owner_id", ctx.userId).is("org_id", null);
  }

  const { data, error } = await query;
  if (error) {
    console.error("[api/v1/projects] GET failed:", error.message);
    return apiJson({ error: "Internal error" }, 500);
  }

  return apiJson({ data: (data ?? []) as Project[] });
}
