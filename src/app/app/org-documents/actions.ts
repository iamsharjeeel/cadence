"use server";

import { revalidatePath } from "next/cache";

import { writeAudit } from "@/lib/audit";
import { notifyUser } from "@/lib/notifications";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { getWorkspaceContext } from "@/lib/workspace";
import {
  ORG_DOCUMENTS_BUCKET,
  buildOrgLibraryPath,
  bucketForOfficialDocPath,
} from "@/lib/org-documents/constants";
import { listOrgMembersForOfficialAssign } from "@/lib/org-documents/queries";

export type ActionResult = { ok: boolean; message: string };

const MAX_FILE_BYTES = 20 * 1024 * 1024;
const REMINDER_COOLDOWN_MS = 24 * 60 * 60 * 1000;

function revalidateDocumentPaths() {
  revalidatePath("/app/documents");
  revalidatePath("/app/onboarding");
}

async function requireOrgManager() {
  const ctx = await getWorkspaceContext();
  if (!ctx?.activeOrgId) {
    return {
      error: "Switch to an organization workspace." as const,
      ctx: null,
    };
  }
  if (ctx.workspaceRole !== "owner" && ctx.workspaceRole !== "admin") {
    return {
      error: "Only organization owners and admins can manage the document library." as const,
      ctx: null,
    };
  }
  return { error: null, ctx };
}

export async function uploadOrgLibraryDocument(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  const gate = await requireOrgManager();
  if (gate.error || !gate.ctx) return { ok: false, message: gate.error };

  const { ctx } = gate;
  const name = String(formData.get("name") ?? "").trim();
  const category = String(formData.get("category") ?? "").trim();
  const file = formData.get("file");

  if (!name) return { ok: false, message: "Document name is required." };
  if (!category) return { ok: false, message: "Category is required." };
  if (!(file instanceof File) || file.size === 0) {
    return { ok: false, message: "A file is required." };
  }
  if (file.size > MAX_FILE_BYTES) {
    return { ok: false, message: "File must be 20 MB or smaller." };
  }

  const orgId = ctx.activeOrgId!;
  const actorId = ctx.realProfile.id;
  const admin = createAdminClient();
  const docId = crypto.randomUUID();
  const storagePath = buildOrgLibraryPath(orgId, docId, file.name);
  const ext = file.name.toLowerCase().slice(file.name.lastIndexOf("."));
  const fileType = ext === ".pdf" ? "pdf" : ext === ".docx" ? "docx" : file.type || "file";

  const { error: uploadError } = await admin.storage
    .from(ORG_DOCUMENTS_BUCKET)
    .upload(storagePath, file, { contentType: file.type || undefined, upsert: false });

  if (uploadError) {
    return {
      ok: false,
      message:
        uploadError.message ||
        "Upload failed. Ensure the org-documents storage bucket exists.",
    };
  }

  const { data: row, error: insertError } = await admin
    .from("official_documents")
    .insert({
      org_id: orgId,
      employee_id: null,
      uploaded_by: actorId,
      name,
      category,
      file_path: storagePath,
      file_type: fileType,
      signing_type: "acknowledgement",
      status: "acknowledged",
    })
    .select("id")
    .single();

  if (insertError || !row) {
    await admin.storage.from(ORG_DOCUMENTS_BUCKET).remove([storagePath]);
    return {
      ok: false,
      message: insertError?.message ?? "Failed to save document record.",
    };
  }

  await writeAudit({
    actorId,
    orgId,
    action: "org_document_uploaded",
    entity: "official_documents",
    payload: { document_id: row.id, name, category },
  });

  revalidateDocumentPaths();
  return { ok: true, message: "Document added to organization library." };
}

export async function assignOrgLibraryDocument(
  libraryDocumentId: string,
  memberIds: string[],
): Promise<ActionResult & { assigned?: number }> {
  const gate = await requireOrgManager();
  if (gate.error || !gate.ctx) return { ok: false, message: gate.error };

  const { ctx } = gate;
  const orgId = ctx.activeOrgId!;
  const actorId = ctx.realProfile.id;
  const uniqueMemberIds = [...new Set(memberIds.filter(Boolean))];

  if (uniqueMemberIds.length === 0) {
    return { ok: false, message: "Select at least one member." };
  }

  const admin = createAdminClient();
  const { data: master, error: masterError } = await admin
    .from("official_documents")
    .select("id, org_id, name, category, file_path, file_type, signing_type")
    .eq("id", libraryDocumentId)
    .is("employee_id", null)
    .single();

  if (masterError || !master) {
    return { ok: false, message: "Library document not found." };
  }
  if (master.org_id !== orgId) {
    return { ok: false, message: "Document is not in this organization." };
  }

  const members = await listOrgMembersForOfficialAssign(orgId);
  const allowed = new Set(members.map((m) => m.id));
  const validIds = uniqueMemberIds.filter((id) => allowed.has(id));
  if (validIds.length === 0) {
    return { ok: false, message: "No valid members selected." };
  }

  const { data: existing } = await admin
    .from("official_documents")
    .select("employee_id")
    .eq("org_id", orgId)
    .eq("name", master.name)
    .eq("file_path", master.file_path)
    .in("employee_id", validIds);

  const already = new Set((existing ?? []).map((r) => r.employee_id));
  const toAssign = validIds.filter((id) => !already.has(id));
  if (toAssign.length === 0) {
    return {
      ok: false,
      message: "All selected members already have this document assigned.",
    };
  }

  const rows = toAssign.map((employeeId) => ({
    org_id: orgId,
    employee_id: employeeId,
    uploaded_by: actorId,
    name: master.name,
    category: master.category,
    file_path: master.file_path,
    file_type: master.file_type,
    signing_type: "acknowledgement" as const,
    status: "pending" as const,
  }));

  const { data: inserted, error: insertError } = await admin
    .from("official_documents")
    .insert(rows)
    .select("id, employee_id");

  if (insertError) return { ok: false, message: insertError.message };

  for (const row of inserted ?? []) {
    if (!row.employee_id) continue;
    await notifyUser({
      userId: row.employee_id,
      orgId,
      type: "official_document_assigned",
      title: "Organization document assigned",
      body: `${master.name} was assigned to you. Please review and acknowledge it.`,
      entity: "official_documents",
      entityId: row.id,
    });
  }

  await writeAudit({
    actorId,
    orgId,
    action: "org_document_assigned",
    entity: "official_documents",
    payload: {
      library_document_id: libraryDocumentId,
      name: master.name,
      member_count: toAssign.length,
      member_ids: toAssign,
    },
  });

  revalidateDocumentPaths();
  return {
    ok: true,
    message: `Assigned to ${toAssign.length} member${toAssign.length === 1 ? "" : "s"}.`,
    assigned: toAssign.length,
  };
}

export async function getOrgOfficialDocumentUrl(
  documentId: string,
): Promise<{ ok: boolean; url?: string; message?: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, message: "Not authenticated." };

  const { data: doc, error } = await supabase
    .from("official_documents")
    .select("id, employee_id, org_id, file_path, uploaded_by")
    .eq("id", documentId)
    .single();

  if (error || !doc) return { ok: false, message: "Document not found." };

  const isAssignee = doc.employee_id === user.id;
  const isUploader = doc.uploaded_by === user.id;
  let canViewLibrary = false;

  if (!isAssignee && !isUploader && doc.org_id) {
    const ctx = await getWorkspaceContext();
    if (ctx?.activeOrgId === doc.org_id) {
      if (
        doc.employee_id === null &&
        (ctx.workspaceRole === "owner" || ctx.workspaceRole === "admin")
      ) {
        canViewLibrary = true;
      } else if (
        doc.employee_id &&
        (ctx.workspaceRole === "owner" || ctx.workspaceRole === "admin")
      ) {
        canViewLibrary = true;
      }
    }
  }

  if (!isAssignee && !isUploader && !canViewLibrary) {
    return { ok: false, message: "You do not have access to this document." };
  }

  const bucket = bucketForOfficialDocPath(doc.file_path);
  const admin = createAdminClient();
  const { data: signed, error: signError } = await admin.storage
    .from(bucket)
    .createSignedUrl(doc.file_path, 3600);

  if (signError || !signed?.signedUrl) {
    return {
      ok: false,
      message: signError?.message ?? "Could not generate download link.",
    };
  }

  return { ok: true, url: signed.signedUrl };
}

export async function acknowledgeOrgOfficialDocument(
  documentId: string,
): Promise<ActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, message: "Not authenticated." };

  const { data: doc, error: fetchError } = await supabase
    .from("official_documents")
    .select("id, employee_id, org_id, name, status, signing_type, file_path")
    .eq("id", documentId)
    .single();

  if (fetchError || !doc) return { ok: false, message: "Document not found." };
  if (doc.employee_id !== user.id) {
    return { ok: false, message: "You can only acknowledge documents assigned to you." };
  }
  if (doc.status !== "pending") {
    return { ok: false, message: "This document is no longer pending acknowledgement." };
  }
  if (doc.signing_type !== "acknowledgement") {
    return { ok: false, message: "This document requires a different signing flow." };
  }
  if (!doc.file_path.includes("/library/")) {
    return { ok: false, message: "Use the onboarding flow for this document." };
  }

  const now = new Date().toISOString();
  const admin = createAdminClient();
  const { error: updateError } = await admin
    .from("official_documents")
    .update({
      status: "acknowledged",
      signed_at: now,
      signature_data: null,
      updated_at: now,
    })
    .eq("id", documentId)
    .eq("employee_id", user.id)
    .eq("status", "pending");

  if (updateError) return { ok: false, message: updateError.message };

  await writeAudit({
    actorId: user.id,
    orgId: doc.org_id,
    action: "org_document_acknowledged",
    entity: "official_documents",
    payload: { document_id: documentId, name: doc.name },
  });

  revalidateDocumentPaths();
  return { ok: true, message: "Document acknowledged." };
}

/** Opportunistic: at most one ack reminder per unacknowledged org doc per 24h. */
export async function checkOrgDocumentAckReminders(): Promise<ActionResult> {
  const ctx = await getWorkspaceContext();
  if (!ctx) return { ok: true, message: "" };

  const userId = ctx.realProfile.id;
  const admin = createAdminClient();

  const { data: pending } = await admin
    .from("official_documents")
    .select("id, name, org_id, file_path")
    .eq("employee_id", userId)
    .eq("status", "pending")
    .eq("signing_type", "acknowledgement")
    .like("file_path", "%/library/%");

  if (!pending?.length) return { ok: true, message: "" };

  const since = new Date(Date.now() - REMINDER_COOLDOWN_MS).toISOString();
  const { data: recent } = await admin
    .from("notifications")
    .select("entity_id")
    .eq("user_id", userId)
    .eq("type", "org_document_ack_reminder")
    .gte("created_at", since);

  const remindedRecently = new Set((recent ?? []).map((n) => n.entity_id));

  for (const doc of pending) {
    if (remindedRecently.has(doc.id)) continue;

    await notifyUser({
      userId,
      orgId: doc.org_id,
      type: "org_document_ack_reminder",
      title: "Document acknowledgement reminder",
      body: `Please acknowledge "${doc.name}" when you have a moment.`,
      entity: "official_documents",
      entityId: doc.id,
    });
  }

  return { ok: true, message: "" };
}
