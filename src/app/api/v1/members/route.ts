import { NextRequest } from "next/server";

import { validateApiKey } from "@/lib/api-auth";
import { apiForbidden, apiJson, apiUnauthorized } from "@/lib/api/v1/response";
import { createAdminClient } from "@/lib/supabase/admin";

type ApiMember = {
  user_id: string;
  name: string | null;
  email: string;
  role: "owner" | "manager" | "employee";
};

function displayRole(role: string): ApiMember["role"] {
  if (role === "owner") return "owner";
  if (role === "admin") return "manager";
  return "employee";
}

export async function GET(request: NextRequest) {
  const ctx = await validateApiKey(request);
  if (!ctx) return apiUnauthorized();
  if (!ctx.orgId) return apiForbidden();

  const db = createAdminClient();
  const { data: memberships, error } = await db
    .from("memberships")
    .select("user_id, role")
    .eq("org_id", ctx.orgId);

  if (error) {
    console.error("[api/v1/members] GET failed:", error.message);
    return apiJson({ error: "Internal error" }, 500);
  }

  const userIds = (memberships ?? []).map((m) => m.user_id);
  if (userIds.length === 0) {
    return apiJson({ data: [] as ApiMember[] });
  }

  const { data: profiles } = await db
    .from("profiles")
    .select("id, full_name, email")
    .in("id", userIds);

  const profileById = new Map(
    (profiles ?? []).map((p) => [p.id, p]),
  );

  const data: ApiMember[] = (memberships ?? []).map((m) => {
    const profile = profileById.get(m.user_id);
    return {
      user_id: m.user_id,
      name: profile?.full_name ?? null,
      email: profile?.email ?? "",
      role: displayRole(m.role),
    };
  });

  return apiJson({ data });
}
