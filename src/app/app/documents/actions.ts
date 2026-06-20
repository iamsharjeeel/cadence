"use server";

import { revalidatePath } from "next/cache";

import { requireActiveProfile, requireRole } from "@/lib/auth";
import { writeAudit } from "@/lib/audit";
import { createAdminClient } from "@/lib/supabase/admin";
import { generateAndEmailDocument } from "@/lib/documents/generate";
import { authorizeTimesheetForDocument } from "@/lib/documents/authorization";
import {
  DOCUMENT_STATUSES,
  type DocumentStatus,
  type DocumentType,
} from "@/lib/documents/types";
import { getResendClient, getResendFromEmail } from "@/lib/resend";
import { formatDate } from "@/lib/utils";

export type ActionResult = { ok: boolean; message: string };

export async function updateDocumentStatus(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  const actor = await requireRole(["admin", "superadmin"]);
  const id = String(formData.get("id") ?? "");
  const status = String(formData.get("status") ?? "") as DocumentStatus;

  if (!DOCUMENT_STATUSES.includes(status)) {
    return { ok: false, message: "Invalid status." };
  }

  const db = createAdminClient();
  const { data: doc } = await db
    .from("documents")
    .select("id, org_id, status")
    .eq("id", id)
    .single();
  if (!doc) return { ok: false, message: "Document not found." };
  if (actor.role === "admin" && (!actor.org_id || doc.org_id !== actor.org_id)) {
    return { ok: false, message: "That document isn't in your organization." };
  }

  const { error } = await db
    .from("documents")
    .update({
      status,
      status_changed_by: actor.id,
      status_changed_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("id", id);
  if (error) return { ok: false, message: "Couldn't update status." };

  await writeAudit({
    actorId: actor.id,
    orgId: doc.org_id,
    action: "document_status_changed",
    entity: "documents",
    payload: { document_id: id, from: doc.status, to: status },
  });

  revalidatePath("/app/documents");
  return { ok: true, message: "Status updated." };
}

export async function resendDocumentEmail(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  const profile = await requireActiveProfile();
  const id = String(formData.get("id") ?? "");

  const db = createAdminClient();
  const { data: doc } = await db
    .from("documents")
    .select("*, timesheet:timesheets(period_start, period_end)")
    .eq("id", id)
    .single();
  if (!doc) return { ok: false, message: "Document not found." };

  const isManager =
    profile.role === "superadmin" ||
    (profile.role === "admin" && profile.org_id != null);
  if (!isManager && doc.employee_id !== profile.id) {
    return { ok: false, message: "Forbidden." };
  }
  if (profile.role === "admin" && (!profile.org_id || doc.org_id !== profile.org_id)) {
    return { ok: false, message: "Forbidden." };
  }
  if (!doc.file_path) {
    return { ok: false, message: "No PDF on file." };
  }

  const { data: employee } = await db
    .from("profiles")
    .select("email, full_name")
    .eq("id", doc.employee_id)
    .single();
  if (!employee) return { ok: false, message: "Employee not found." };

  const { data: file, error: dlErr } = await db.storage
    .from("documents")
    .download(doc.file_path);
  if (dlErr || !file) {
    return { ok: false, message: "Couldn't read the PDF." };
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  const typeLabel = doc.type === "pay_advice" ? "Pay Advice" : "Invoice";
  const ts = doc.timesheet as { period_start: string; period_end: string } | null;
  const period = ts
    ? `${formatDate(ts.period_start)} – ${formatDate(ts.period_end)}`
    : "";

  try {
    const resend = getResendClient();
    const { error } = await resend.emails.send({
      from: getResendFromEmail(),
      to: employee.email,
      subject: `Your ${typeLabel} — ${period} — ${doc.document_number}`,
      html: `<p>Your ${typeLabel.toLowerCase()} is attached.</p>`,
      attachments: [
        {
          filename: `${doc.document_number}.pdf`,
          content: buffer,
        },
      ],
    });
    if (error) return { ok: false, message: "Couldn't send email." };

    await db
      .from("documents")
      .update({ emailed_at: new Date().toISOString() })
      .eq("id", id);

    await writeAudit({
      actorId: profile.id,
      orgId: doc.org_id,
      action: "document_emailed",
      entity: "documents",
      payload: { document_id: id, to: employee.email, resend: true },
    });

    revalidatePath("/app/documents");
    return { ok: true, message: "Email sent." };
  } catch {
    return { ok: false, message: "Couldn't send email." };
  }
}

export async function generateDocumentForTimesheet(input: {
  timesheetId: string;
  type: DocumentType;
  gstEnabled: boolean;
  gstRate: number;
}): Promise<ActionResult & { documentId?: string }> {
  const profile = await requireActiveProfile();
  const auth = await authorizeTimesheetForDocument(profile, input.timesheetId);
  if (!auth.ok) return { ok: false, message: auth.message };

  const result = await generateAndEmailDocument({
    actor: profile,
    timesheet: auth.timesheet,
    type: input.type,
    gstEnabled: input.gstEnabled,
    gstRate: input.gstRate,
  });

  if (!result.ok) return { ok: false, message: result.message };

  revalidatePath("/app/documents");
  revalidatePath("/app/timesheets");
  revalidatePath(`/app/timesheets/${input.timesheetId}`);
  return {
    ok: true,
    message: `Document ${result.documentNumber} generated and emailed.`,
    documentId: result.documentId,
  };
}
