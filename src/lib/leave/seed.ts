import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";

const DEFAULT_TYPES = [
  {
    name: "Annual Leave",
    category: "annual",
    default_days_per_year: 20,
    color: "#B8862F",
  },
  {
    name: "Sick Leave",
    category: "sick",
    default_days_per_year: 10,
    color: "#6B6F76",
  },
  {
    name: "Unpaid Leave",
    category: "unpaid",
    default_days_per_year: null,
    color: "#9A9EA6",
  },
  {
    name: "Public Holiday",
    category: "public_holiday",
    default_days_per_year: null,
    color: "#A0751F",
  },
] as const;

/** Seeds default leave types when an org is created. */
export async function seedLeaveTypesForOrg(orgId: string): Promise<void> {
  const db = createAdminClient();
  const rows = DEFAULT_TYPES.map((t) => ({
    org_id: orgId,
    name: t.name,
    category: t.category,
    default_days_per_year: t.default_days_per_year,
    color: t.color,
    is_active: true,
    unit: "days" as const,
  }));
  await db.from("leave_types").insert(rows);
}

/** Apply default allocation to all active employees for the current year. */
export async function applyDefaultBalancesForOrg(
  orgId: string,
  year: number,
): Promise<number> {
  const db = createAdminClient();
  // Org employees are defined by `memberships`, not the vestigial
  // profiles.org_id/role columns (frozen after the Track-C cutover).
  const [{ data: types }, { data: members }] = await Promise.all([
    db
      .from("leave_types")
      .select("id, default_days_per_year, category")
      .eq("org_id", orgId)
      .eq("is_active", true),
    db
      .from("memberships")
      .select("user_id")
      .eq("org_id", orgId)
      .eq("role", "employee"),
  ]);

  const memberIds = (members ?? []).map((m) => m.user_id);
  const { data: employees } = memberIds.length
    ? await db
        .from("profiles")
        .select("id")
        .in("id", memberIds)
        .eq("status", "active")
    : { data: [] as { id: string }[] };

  let count = 0;
  for (const emp of employees ?? []) {
    for (const lt of types ?? []) {
      const allocated =
        lt.default_days_per_year ??
        (lt.category === "unpaid" ? 365 : 0);
      const { error } = await db.from("leave_balances").upsert(
        {
          org_id: orgId,
          employee_id: emp.id,
          leave_type_id: lt.id,
          year,
          allocated_days: allocated,
          used_days: 0,
          pending_days: 0,
        },
        { onConflict: "employee_id,leave_type_id,year" },
      );
      if (!error) count++;
    }
  }
  return count;
}
