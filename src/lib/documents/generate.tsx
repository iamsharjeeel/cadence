import "server-only";

import { renderToBuffer } from "@react-pdf/renderer";

import { writeAudit } from "@/lib/audit";
import { decryptBankField } from "@/lib/bank-crypto";
import { createAdminClient } from "@/lib/supabase/admin";
import { formatDate, formatMoney, titleCase } from "@/lib/utils";
import type { Profile, Timesheet } from "@/types/db";
import { computeDocumentAmounts } from "./amounts";
import { InvoicePdf } from "./pdf/InvoicePdf";
import { PayAdvicePdf } from "./pdf/PayAdvicePdf";
import type { DocumentType } from "./types";
import { getResendClient, getResendFromEmail } from "@/lib/resend";

export type GenerateResult =
  | { ok: true; documentId: string; documentNumber: string }
  | { ok: false; message: string };

export async function generateAndEmailDocument(params: {
  actor: Profile;
  timesheet: Timesheet;
  type: DocumentType;
  gstEnabled: boolean;
  gstRate: number;
}): Promise<GenerateResult> {
  const { actor, timesheet, type, gstEnabled, gstRate } = params;
  const db = createAdminClient();

  const [{ data: employee }, { data: org }, { data: rows }] = await Promise.all([
    db.from("profiles").select("*").eq("id", timesheet.employee_id).single(),
    db.from("organizations").select("*").eq("id", timesheet.org_id).single(),
    db
      .from("timesheet_rows")
      .select("hours")
      .eq("timesheet_id", timesheet.id),
  ]);

  if (!employee || !org) {
    return { ok: false, message: "Missing employee or organization data." };
  }

  const totalHours = (rows ?? []).reduce(
    (sum, r) => sum + Number(r.hours),
    0,
  );
  const subtotal = timesheet.calculated_total ?? 0;
  const currency = timesheet.currency_snapshot ?? employee.currency ?? "USD";
  const amounts = computeDocumentAmounts(subtotal, gstEnabled, gstRate);

  const { data: docNumber, error: numErr } = await db.rpc(
    "next_document_number",
    { p_org_id: timesheet.org_id, p_type: type },
  );
  if (numErr || !docNumber) {
    return { ok: false, message: "Couldn't allocate a document number." };
  }

  const documentId = crypto.randomUUID();
  const issueDate = new Date();
  const issueLabel = issueDate.toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });

  let approverName = "—";
  if (timesheet.approved_by) {
    const { data: approver } = await db
      .from("profiles")
      .select("full_name, email")
      .eq("id", timesheet.approved_by)
      .single();
    approverName = approver?.full_name?.trim() || approver?.email || "—";
  }

  const rateLabel = formatMoney(
    timesheet.rate_snapshot,
    currency,
  );
  const subtotalLabel = formatMoney(amounts.subtotal, currency);
  const gstLabel = formatMoney(amounts.gst_amount, currency);
  const totalLabel = formatMoney(amounts.total, currency);

  const paymentTerms = employee.payment_terms_days ?? 14;
  const dueDate = new Date(issueDate);
  dueDate.setDate(dueDate.getDate() + paymentTerms);

  const bankAccount = decryptBankField(employee.bank_account_number);
  const bankBsb = decryptBankField(employee.bank_bsb_swift);

  let pdfBuffer: Buffer;
  if (type === "pay_advice") {
    pdfBuffer = await renderToBuffer(
      <PayAdvicePdf
        data={{
          orgName: org.name,
          orgLogoUrl: org.logo_url,
          documentNumber: docNumber,
          issueDate: issueLabel,
          employeeName: employee.full_name?.trim() || employee.email,
          employeeEmail: employee.email,
          employeeRole: titleCase(employee.role),
          periodStart: formatDate(timesheet.period_start),
          periodEnd: formatDate(timesheet.period_end),
          totalHours,
          rateLabel,
          subtotalLabel,
          gstEnabled,
          gstRate,
          gstLabel,
          totalLabel,
          approvedBy: approverName,
          approvedAt: formatDate(timesheet.approved_at),
        }}
      />,
    );
  } else {
    pdfBuffer = await renderToBuffer(
      <InvoicePdf
        data={{
          orgName: org.name,
          documentNumber: docNumber,
          issueDate: issueLabel,
          dueDate: dueDate.toLocaleDateString(undefined, {
            year: "numeric",
            month: "short",
            day: "numeric",
          }),
          contractorName: employee.full_name?.trim() || employee.email,
          contractorAddress: employee.address,
          taxId: employee.tax_id,
          periodStart: formatDate(timesheet.period_start),
          periodEnd: formatDate(timesheet.period_end),
          totalHours,
          rateLabel,
          subtotalLabel,
          gstEnabled,
          gstRate,
          gstLabel,
          totalLabel,
          bankName: employee.bank_name,
          accountName: employee.bank_account_name,
          accountNumber: bankAccount || null,
          bsbSwift: bankBsb || null,
          paymentTermsDays: paymentTerms,
        }}
      />,
    );
  }

  const filePath = `${timesheet.org_id}/${timesheet.employee_id}/${documentId}.pdf`;
  const { error: uploadErr } = await db.storage
    .from("documents")
    .upload(filePath, pdfBuffer, {
      contentType: "application/pdf",
      upsert: true,
    });
  if (uploadErr) {
    return { ok: false, message: "Couldn't save the PDF." };
  }

  const { error: insertErr } = await db.from("documents").insert({
    id: documentId,
    org_id: timesheet.org_id,
    timesheet_id: timesheet.id,
    employee_id: timesheet.employee_id,
    type,
    status: "draft",
    document_number: docNumber,
    gst_enabled: gstEnabled,
    gst_rate: gstRate,
    subtotal: amounts.subtotal,
    gst_amount: amounts.gst_amount,
    total: amounts.total,
    currency,
    file_path: filePath,
    generated_by: actor.id,
  });
  if (insertErr) {
    return { ok: false, message: "Couldn't create the document record." };
  }

  await writeAudit({
    actorId: actor.id,
    orgId: timesheet.org_id,
    action: "document_generated",
    entity: "documents",
    payload: {
      document_id: documentId,
      timesheet_id: timesheet.id,
      type,
      document_number: docNumber,
    },
  });

  const typeLabel = type === "pay_advice" ? "Pay Advice" : "Invoice";
  const period = `${formatDate(timesheet.period_start)} – ${formatDate(timesheet.period_end)}`;

  try {
    const resend = getResendClient();
    const { error: emailErr } = await resend.emails.send({
      from: getResendFromEmail(),
      to: employee.email,
      subject: `Your ${typeLabel} — ${period} — ${docNumber}`,
      html: `
        <div style="font-family: Inter, sans-serif; color: #14151A; max-width: 520px;">
          <p style="font-size: 18px; font-weight: 600; color: #1F8A8A;">Cadence</p>
          <p>Hi ${employee.full_name?.split(" ")[0] ?? "there"},</p>
          <p>Your ${typeLabel.toLowerCase()} for <strong>${period}</strong> is attached.</p>
          <p style="color: #6B6F76; font-size: 14px;">Document: ${docNumber}<br/>Total: ${totalLabel}</p>
          <p style="color: #6B6F76; font-size: 12px;">Generated by Cadence</p>
        </div>
      `,
      attachments: [
        {
          filename: `${docNumber}.pdf`,
          content: pdfBuffer,
        },
      ],
    });

    if (!emailErr) {
      await db
        .from("documents")
        .update({ emailed_at: new Date().toISOString() })
        .eq("id", documentId);

      await writeAudit({
        actorId: actor.id,
        orgId: timesheet.org_id,
        action: "document_emailed",
        entity: "documents",
        payload: { document_id: documentId, to: employee.email },
      });
    }
  } catch (e) {
    console.error("[resend] email failed:", e);
    return {
      ok: true,
      documentId,
      documentNumber: docNumber,
    };
  }

  return { ok: true, documentId, documentNumber: docNumber };
}
