import type { Json } from "@/types/db";

export function summarizePayload(
  action: string,
  payload: Json | null,
): string {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    return "—";
  }
  const p = payload as Record<string, unknown>;

  if (action === "profile.status_change" && p.from && p.to) {
    return `Status changed from ${p.from} → ${p.to}`;
  }
  if (action === "profile.role_change" && p.from && p.to) {
    return `Role changed from ${p.from} → ${p.to}`;
  }
  if (action === "timesheet_approved" && p.calculated_total != null) {
    return `Approved · total ${p.calculated_total}`;
  }
  if (action === "timesheet_rejected" && p.note) {
    return `Rejected · ${String(p.note).slice(0, 80)}`;
  }
  if (
    (action === "timesheet_recalled" || action === "timesheet_returned_to_draft") &&
    p.period_start &&
    p.period_end
  ) {
    const verb =
      action === "timesheet_recalled" ? "Recalled" : "Returned to draft";
    return `${verb} · ${String(p.period_start)} → ${String(p.period_end)}`;
  }
  if (action === "leave_approved" || action === "leave_rejected") {
    return p.note ? String(p.note).slice(0, 80) : "Leave request updated";
  }
  if (action === "member_invited" && p.email) {
    return `Invited ${String(p.email)} as ${p.role ?? "employee"}`;
  }
  if (action === "member_removed" && p.email) {
    return `Removed ${String(p.email)} from org`;
  }
  if (action === "member_invite_cancelled" && p.email) {
    return `Cancelled invite to ${String(p.email)}`;
  }
  if (action === "org_settings_updated" && p.section) {
    return `Updated ${p.section}`;
  }
  if (action === "org.update" || action === "org_settings_updated") {
    if (p.name) return `Organization: ${p.name}`;
    if (p.allowed_domains) return `Domains updated`;
  }
  if (p.timesheet_id) return `Timesheet ${String(p.timesheet_id).slice(0, 8)}…`;
  if (p.document_id) return `Document ${String(p.document_id).slice(0, 8)}…`;
  if (p.request_id) return `Request ${String(p.request_id).slice(0, 8)}…`;

  const keys = Object.keys(p).slice(0, 3);
  if (keys.length === 0) return "—";
  return keys.map((k) => `${k}: ${String(p[k]).slice(0, 40)}`).join(" · ");
}
