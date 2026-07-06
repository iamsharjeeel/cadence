"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { canApproveInOrg } from "@/lib/approvals";
import { writeAudit } from "@/lib/audit";
import { notifyOrgAdmins, notifyUser } from "@/lib/notifications";
import { fetchOrgSettings } from "@/lib/org-settings/actions";
import { requireActiveProfile } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { getWorkspaceContext } from "@/lib/workspace";
import {
  validateDateRange,
  validateMaxLength,
  validateNonNegativeNumber,
} from "@/lib/validation";

export type ActionResult = { ok: boolean; message: string };

export type ExpenseRow = {
  id: string;
  org_id: string;
  employee_id: string;
  amount: number;
  currency: string;
  description: string;
  expense_date: string;
  status: string;
  rejection_note: string | null;
  created_at: string;
  employee_name?: string;
};

async function requireOrgWorkspace() {
  const ctx = await getWorkspaceContext();
  if (!ctx) redirect("/login");
  if (!ctx.activeOrgId) {
    return { ok: false as const, message: "Switch to an organization workspace." };
  }
  const orgId = ctx.activeOrgId;
  return { ok: true as const, ctx, orgId };
}

async function requireExpenseApprover() {
  const gate = await requireOrgWorkspace();
  if (!gate.ok) return gate;
  const allowed = await canApproveInOrg(gate.orgId, gate.ctx.workspaceRole);
  if (!allowed) {
    return { ok: false as const, message: "Forbidden." };
  }
  return {
    ok: true as const,
    ctx: gate.ctx,
    orgId: gate.orgId,
    actor: gate.ctx.effectiveProfile,
  };
}

export async function getExpensesForWorkspace(
  orgId: string,
  employeeId: string,
): Promise<ExpenseRow[]> {
  const db = createAdminClient();
  const { data } = await db
    .from("expenses")
    .select("*")
    .eq("org_id", orgId)
    .eq("employee_id", employeeId)
    .order("expense_date", { ascending: false });

  return (data ?? []) as ExpenseRow[];
}

export async function getPendingExpenses(orgId: string): Promise<ExpenseRow[]> {
  const db = createAdminClient();
  const { data } = await db
    .from("expenses")
    .select("*")
    .eq("org_id", orgId)
    .eq("status", "pending")
    .order("created_at", { ascending: true });

  const rows = (data ?? []) as ExpenseRow[];
  if (!rows.length) return [];

  const employeeIds = [...new Set(rows.map((r) => r.employee_id))];
  const { data: people } = await db
    .from("profiles")
    .select("id, full_name, email")
    .in("id", employeeIds);

  const nameById = new Map(
    (people ?? []).map((p) => [p.id, p.full_name?.trim() || p.email]),
  );

  return rows.map((row) => ({
    ...row,
    employee_name: nameById.get(row.employee_id) ?? "Unknown",
  }));
}

export async function submitExpense(input: {
  amount: number;
  currency: string;
  description: string;
  expenseDate: string;
}): Promise<ActionResult> {
  const gate = await requireOrgWorkspace();
  if (!gate.ok) return gate;

  const profile = await requireActiveProfile();
  const amountV = validateNonNegativeNumber(input.amount, "Amount");
  if (!amountV.ok || amountV.value <= 0) {
    return { ok: false, message: "Amount must be greater than zero." };
  }

  const descV = validateMaxLength(input.description, 500, "Description");
  if (!descV.ok) return { ok: false, message: descV.error };

  const dates = validateDateRange(input.expenseDate, input.expenseDate);
  if (!dates.ok) return { ok: false, message: dates.error };

  const currency = input.currency.trim().toUpperCase().slice(0, 3) || "USD";
  const settings = await fetchOrgSettings(gate.orgId);
  const requiresApproval = settings?.approvals_expenses ?? false;
  const status = requiresApproval ? "pending" : "approved";
  const now = new Date().toISOString();

  const db = createAdminClient();
  const { data: inserted, error } = await db
    .from("expenses")
    .insert({
      org_id: gate.orgId,
      employee_id: profile.id,
      amount: amountV.value,
      currency,
      description: descV.value,
      expense_date: dates.value.start,
      status,
      reviewed_at: requiresApproval ? null : now,
      reviewed_by: requiresApproval ? null : profile.id,
    })
    .select("id")
    .single();

  if (error || !inserted) {
    console.error("[expenses] submit failed:", error?.message);
    return { ok: false, message: "Couldn't submit expense." };
  }

  if (requiresApproval) {
    const employeeName = profile.full_name?.trim() || profile.email;
    await notifyOrgAdmins({
      orgId: gate.orgId,
      type: "expense_submitted",
      title: `Expense submitted by ${employeeName}`,
      body: `${currency} ${amountV.value.toFixed(2)} · ${descV.value}`,
      entity: "expenses",
      entityId: inserted.id,
      excludeUserId: profile.id,
    });
  }

  await writeAudit({
    actorId: profile.id,
    orgId: gate.orgId,
    action: requiresApproval ? "expense_submitted" : "expense_auto_approved",
    entity: "expenses",
    payload: { expense_id: inserted.id, amount: amountV.value, currency },
  });

  revalidatePath("/app/expenses");
  return {
    ok: true,
    message: requiresApproval
      ? "Expense submitted for approval."
      : "Expense recorded.",
  };
}

export async function approveExpense(id: string): Promise<ActionResult> {
  const gate = await requireExpenseApprover();
  if (!gate.ok) return gate;

  const db = createAdminClient();
  const { data: expense } = await db
    .from("expenses")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  if (!expense || expense.org_id !== gate.orgId || expense.status !== "pending") {
    return { ok: false, message: "Expense not found or not pending." };
  }

  const now = new Date().toISOString();
  const { error } = await db
    .from("expenses")
    .update({
      status: "approved",
      reviewed_by: gate.actor.id,
      reviewed_at: now,
      updated_at: now,
    })
    .eq("id", id);

  if (error) {
    return { ok: false, message: "Couldn't approve expense." };
  }

  await notifyUser({
    orgId: gate.orgId,
    userId: expense.employee_id,
    type: "expense_approved",
    title: "Your expense was approved",
    body: `${expense.currency} ${Number(expense.amount).toFixed(2)}`,
    entity: "expenses",
    entityId: id,
  });

  await writeAudit({
    actorId: gate.actor.id,
    orgId: gate.orgId,
    action: "expense_approved",
    entity: "expenses",
    payload: { expense_id: id },
  });

  revalidatePath("/app/expenses");
  return { ok: true, message: "Expense approved." };
}

export async function rejectExpense(
  id: string,
  note: string,
): Promise<ActionResult> {
  const gate = await requireExpenseApprover();
  if (!gate.ok) return gate;

  const trimmed = note.trim();
  if (!trimmed) {
    return { ok: false, message: "Rejection note is required." };
  }

  const db = createAdminClient();
  const { data: expense } = await db
    .from("expenses")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  if (!expense || expense.org_id !== gate.orgId || expense.status !== "pending") {
    return { ok: false, message: "Expense not found or not pending." };
  }

  const now = new Date().toISOString();
  const { error } = await db
    .from("expenses")
    .update({
      status: "rejected",
      rejection_note: trimmed,
      reviewed_by: gate.actor.id,
      reviewed_at: now,
      updated_at: now,
    })
    .eq("id", id);

  if (error) {
    return { ok: false, message: "Couldn't reject expense." };
  }

  await notifyUser({
    orgId: gate.orgId,
    userId: expense.employee_id,
    type: "expense_rejected",
    title: "Your expense was rejected",
    body: trimmed,
    entity: "expenses",
    entityId: id,
  });

  await writeAudit({
    actorId: gate.actor.id,
    orgId: gate.orgId,
    action: "expense_rejected",
    entity: "expenses",
    payload: { expense_id: id, note: trimmed },
  });

  revalidatePath("/app/expenses");
  return { ok: true, message: "Expense rejected." };
}
