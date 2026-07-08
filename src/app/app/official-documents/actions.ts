"use server";

import { revalidatePath } from "next/cache";

import { writeAudit } from "@/lib/audit";
import { notifyOrgAdmins, notifyUser } from "@/lib/notifications";
import { requireActiveProfile, requireRole } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  validateEnum,
  validateMaxLength,
} from "@/lib/validation";
import type { OfficialDocCategory } from "@/types/db";

export type ActionResult = { ok: boolean; message: string };

const OFFICIAL_CATEGORIES = [
  "contract",
  "offer_letter",
  "policy",
  "nda",
  "other",
] as const satisfies readonly OfficialDocCategory[];

const SIGNING_TYPES = ["e_signature", "acknowledgement"] as const;

const MAX_BYTES = 20 * 1024 * 1024;
const MAX_SIGNATURE_BYTES = 500_000;
const MAX_NOTE_LENGTH = 500;
const ALLOWED_EXT = [".pdf", ".docx"];
const ALLOWED_MIME = [
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
];

export async function uploadOfficialDocument(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  const actor = await requireRole(["admin", "superadmin"]);
  const orgId =
    actor.role === "admin" ? actor.org_id : String(formData.get("org_id") ?? "");
  if (!orgId) return { ok: false, message: "Organization required." };

  const nameV = validateMaxLength(String(formData.get("name") ?? ""), 120, "Name");
  if (!nameV.ok) return { ok: false, message: nameV.error };
  const name = nameV.value;

  const categoryV = validateEnum(
    String(formData.get("category") ?? ""),
    OFFICIAL_CATEGORIES,
    "category",
  );
  if (!categoryV.ok) return { ok: false, message: categoryV.error };
  const category = categoryV.value;

  const signingV = validateEnum(
    String(formData.get("signing_type") ?? ""),
    SIGNING_TYPES,
    "signing type",
  );
  if (!signingV.ok) return { ok: false, message: signingV.error };
  const signingType = signingV.value;

  const assignee = String(formData.get("employee_id") ?? "").trim();
  const assignAll = formData.get("assign_all") === "on";
  const file = formData.get("file") as File | null;

  if (!file?.size) {
    return { ok: false, message: "Name and file are required." };
  }
  if (file.size > MAX_BYTES) {
    return { ok: false, message: "File must be under 20MB." };
  }

  const ext = file.name.toLowerCase().slice(file.name.lastIndexOf("."));
  if (!ALLOWED_EXT.includes(ext)) {
    return { ok: false, message: "Only PDF and DOCX files are allowed." };
  }
  if (!ALLOWED_MIME.includes(file.type) && file.type !== "") {
    return { ok: false, message: "Invalid file type." };
  }

  const fileType = ext === ".pdf" ? "pdf" : "docx";
  const db = createAdminClient();

  let employeeIds: string[] = [];
  if (assignAll) {
    const { data: memRows } = await db
      .from("memberships")
      .select("user_id")
      .eq("org_id", orgId)
      .eq("role", "employee");

    const employeeMemberIds = (memRows ?? []).map((m) => m.user_id as string);
    if (employeeMemberIds.length) {
      const { data: people } = await db
        .from("profiles")
        .select("id")
        .in("id", employeeMemberIds)
        .eq("status", "active");
      employeeIds = (people ?? []).map((p) => p.id);
    }
  } else if (assignee) {
    const { data: membership } = await db
      .from("memberships")
      .select("user_id")
      .eq("org_id", orgId)
      .eq("user_id", assignee)
      .maybeSingle();
    if (!membership) {
      return { ok: false, message: "Invalid employee for this organization." };
    }

    const { data: assigneeProfile } = await db
      .from("profiles")
      .select("id")
      .eq("id", assignee)
      .eq("status", "active")
      .maybeSingle();
    if (!assigneeProfile) {
      return { ok: false, message: "Invalid employee for this organization." };
    }
    employeeIds = [assigneeProfile.id];
  } else {
    return { ok: false, message: "Assign to an employee or all employees." };
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  let uploaded = 0;

  for (const employeeId of employeeIds) {
    const docId = crypto.randomUUID();
    const path = `${orgId}/${employeeId}/${docId}/${file.name}`;
    const { error: upErr } = await db.storage
      .from("official-documents")
      .upload(path, buffer, {
        contentType: file.type || "application/octet-stream",
        upsert: true,
      });
    if (upErr) continue;

    const { error: insErr } = await db.from("official_documents").insert({
      id: docId,
      org_id: orgId,
      employee_id: employeeId,
      uploaded_by: actor.id,
      name,
      category,
      file_path: path,
      file_type: fileType,
      signing_type: signingType,
      status: "pending",
    });
    if (!insErr) {
      uploaded++;
      await notifyUser({
        orgId,
        userId: employeeId,
        type: "official_document_assigned",
        title: "You have a document to sign",
        body: name,
        entity: "official_documents",
        entityId: docId,
      });
    }
  }

  if (uploaded === 0) {
    return { ok: false, message: "Upload failed." };
  }

  await writeAudit({
    actorId: actor.id,
    orgId,
    action: "official_document_uploaded",
    entity: "official_documents",
    payload: { name, count: uploaded },
  });

  revalidatePath("/app/documents");
  return {
    ok: true,
    message: `Uploaded to ${uploaded} employee${uploaded === 1 ? "" : "s"}.`,
  };
}

export async function getOfficialDocumentUrl(
  id: string,
): Promise<{ ok: boolean; url?: string; message?: string }> {
  const profile = await requireActiveProfile();
  const db = createAdminClient();

  const { data: doc } = await db
    .from("official_documents")
    .select("id, org_id, employee_id, file_path, status")
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

  const { data: signed } = await db.storage
    .from("official-documents")
    .createSignedUrl(doc.file_path, 60 * 60);
  if (!signed?.signedUrl) {
    return { ok: false, message: "Couldn't create download link." };
  }

  return { ok: true, url: signed.signedUrl };
}

export async function acknowledgeOfficialDocument(
  id: string,
): Promise<ActionResult> {
  const profile = await requireActiveProfile();
  const db = createAdminClient();

  const { data: doc } = await db
    .from("official_documents")
    .select("id, org_id, employee_id, signing_type, status, name")
    .eq("id", id)
    .single();
  if (!doc || doc.employee_id !== profile.id) {
    return { ok: false, message: "Document not found." };
  }
  if (doc.signing_type !== "acknowledgement") {
    return { ok: false, message: "This document requires a signature." };
  }
  if (doc.status !== "pending") {
    return { ok: false, message: "This document is no longer pending acknowledgement." };
  }

  const { data: updated, error } = await db
    .from("official_documents")
    .update({
      status: "acknowledged",
      signed_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("id", id)
    .eq("status", "pending")
    .select("id");
  if (error) return { ok: false, message: "Couldn't acknowledge document." };
  if (!updated || updated.length === 0) {
    // Another request already acknowledged this document; don't overwrite or re-notify.
    return { ok: true, message: "Document acknowledged." };
  }

  await writeAudit({
    actorId: profile.id,
    orgId: doc.org_id,
    action: "official_document_acknowledged",
    entity: "official_documents",
    payload: { document_id: id },
  });

  const employeeName = profile.full_name?.trim() || profile.email;
  await notifyOrgAdmins({
    orgId: doc.org_id,
    type: "official_document_signed",
    title: `${employeeName} signed ${doc.name}`,
    entity: "official_documents",
    entityId: id,
    excludeUserId: profile.id,
  });

  revalidatePath("/app/documents");
  revalidatePath("/app/onboarding");
  return { ok: true, message: "Document acknowledged." };
}

export async function signOfficialDocument(
  id: string,
  signatureData: string,
): Promise<ActionResult> {
  const profile = await requireActiveProfile();
  const db = createAdminClient();

  const { data: doc } = await db
    .from("official_documents")
    .select("id, org_id, employee_id, signing_type, status, name")
    .eq("id", id)
    .single();
  if (!doc || doc.employee_id !== profile.id) {
    return { ok: false, message: "Document not found." };
  }
  if (doc.signing_type !== "e_signature") {
    return { ok: false, message: "This document uses acknowledgement only." };
  }
  if (!signatureData?.startsWith("data:image/png;base64,")) {
    return { ok: false, message: "Invalid signature." };
  }
  if (signatureData.length > MAX_SIGNATURE_BYTES) {
    return { ok: false, message: "Signature image is too large." };
  }
  if (doc.status !== "pending") {
    return { ok: false, message: "This document is no longer pending signature." };
  }

  const { data: updated, error } = await db
    .from("official_documents")
    .update({
      status: "signed",
      signed_at: new Date().toISOString(),
      signature_data: signatureData,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id)
    .eq("status", "pending")
    .select("id");
  if (error) return { ok: false, message: "Couldn't sign document." };
  if (!updated || updated.length === 0) {
    // Another request already signed this document; don't overwrite or re-notify.
    return { ok: true, message: "Document signed." };
  }

  await writeAudit({
    actorId: profile.id,
    orgId: doc.org_id,
    action: "official_document_signed",
    entity: "official_documents",
    payload: { document_id: id },
  });

  const employeeName = profile.full_name?.trim() || profile.email;
  await notifyOrgAdmins({
    orgId: doc.org_id,
    type: "official_document_signed",
    title: `${employeeName} signed ${doc.name}`,
    entity: "official_documents",
    entityId: id,
    excludeUserId: profile.id,
  });

  revalidatePath("/app/documents");
  revalidatePath("/app/onboarding");
  return { ok: true, message: "Document signed." };
}

export async function rejectOfficialDocument(
  id: string,
  note: string,
): Promise<ActionResult> {
  const profile = await requireActiveProfile();
  const db = createAdminClient();

  const { data: doc } = await db
    .from("official_documents")
    .select("id, org_id, employee_id")
    .eq("id", id)
    .single();
  if (!doc || doc.employee_id !== profile.id) {
    return { ok: false, message: "Document not found." };
  }

  const noteV = validateMaxLength(note, MAX_NOTE_LENGTH, "Note");
  if (!noteV.ok) return { ok: false, message: noteV.error };

  const { error } = await db
    .from("official_documents")
    .update({
      status: "rejected",
      employee_note: noteV.value,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id);
  if (error) return { ok: false, message: "Couldn't submit note." };

  await writeAudit({
    actorId: profile.id,
    orgId: doc.org_id,
    action: "official_document_rejected",
    entity: "official_documents",
    payload: { document_id: id, note },
  });

  revalidatePath("/app/documents");
  return { ok: true, message: "Note submitted to manager." };
}
