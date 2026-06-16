"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { writeAudit } from "@/lib/audit";
import { requireActiveProfile } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { getWorkspaceContext } from "@/lib/workspace";
import { validateMaxLength } from "@/lib/validation";
import {
  buildUserDocStoragePath,
  fileToBuffer,
  removeUserDocFromStorage,
  uploadUserDocToStorage,
  validateUserDocFile,
} from "@/lib/user-documents/storage";

export type ActionResult = { ok: boolean; message: string };

export async function uploadPersonalUserDocument(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  const ctx = await getWorkspaceContext();
  if (!ctx) redirect("/login");
  if (ctx.activeOrgId && !ctx.isSuperadmin) {
    return {
      ok: false,
      message: "Switch to Personal workspace to upload to your library.",
    };
  }

  const profile = ctx.effectiveProfile;
  const file = formData.get("file") as File | null;
  const validated = validateUserDocFile(file);
  if (!validated.ok) return { ok: false, message: validated.error };

  const titleInput = String(formData.get("title") ?? "").trim();
  const titleV = validateMaxLength(
    titleInput || validated.file.fileName,
    200,
    "Title",
  );
  if (!titleV.ok) return { ok: false, message: titleV.error };

  const buffer = await fileToBuffer(file!);
  const docId = crypto.randomUUID();
  const filePath = buildUserDocStoragePath(
    profile.id,
    docId,
    validated.file.fileName,
  );

  const upload = await uploadUserDocToStorage(
    filePath,
    buffer,
    validated.file.mimeType,
  );
  if (!upload.ok) return { ok: false, message: upload.error };

  const db = createAdminClient();
  const { error: insertErr } = await db.from("user_documents").insert({
    id: docId,
    owner_id: profile.id,
    org_id: null,
    uploaded_by: profile.id,
    source: "personal",
    title: titleV.value,
    file_path: filePath,
    file_name: validated.file.fileName,
    mime_type: validated.file.mimeType,
  });

  if (insertErr) {
    console.error("[user-documents] insert failed:", insertErr.message);
    await removeUserDocFromStorage(filePath);
    return { ok: false, message: "Couldn't save the document record." };
  }

  revalidatePath("/app/documents");
  return { ok: true, message: "Document uploaded." };
}

export async function assignUserDocumentToMember(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  const ctx = await getWorkspaceContext();
  if (!ctx) redirect("/login");
  if (!ctx.activeOrgId) {
    return { ok: false, message: "Switch to an organization workspace." };
  }
  if (ctx.workspaceRole !== "owner" && ctx.workspaceRole !== "admin") {
    return { ok: false, message: "Only org owners and managers can assign documents." };
  }

  const orgId = ctx.activeOrgId;
  const actor = ctx.effectiveProfile;
  const targetUserId = String(formData.get("owner_id") ?? "").trim();
  if (!targetUserId) {
    return { ok: false, message: "Select a team member." };
  }

  const db = createAdminClient();
  const { data: membership } = await db
    .from("memberships")
    .select("user_id")
    .eq("org_id", orgId)
    .eq("user_id", targetUserId)
    .maybeSingle();
  if (!membership) {
    return { ok: false, message: "That user is not a member of this organization." };
  }

  const file = formData.get("file") as File | null;
  const validated = validateUserDocFile(file);
  if (!validated.ok) return { ok: false, message: validated.error };

  const titleInput = String(formData.get("title") ?? "").trim();
  const titleV = validateMaxLength(
    titleInput || validated.file.fileName,
    200,
    "Title",
  );
  if (!titleV.ok) return { ok: false, message: titleV.error };

  const buffer = await fileToBuffer(file!);
  const docId = crypto.randomUUID();
  const filePath = buildUserDocStoragePath(
    targetUserId,
    docId,
    validated.file.fileName,
  );

  const upload = await uploadUserDocToStorage(
    filePath,
    buffer,
    validated.file.mimeType,
  );
  if (!upload.ok) return { ok: false, message: upload.error };

  const { error: insertErr } = await db.from("user_documents").insert({
    id: docId,
    owner_id: targetUserId,
    org_id: orgId,
    uploaded_by: actor.id,
    source: "org_assigned",
    title: titleV.value,
    file_path: filePath,
    file_name: validated.file.fileName,
    mime_type: validated.file.mimeType,
  });

  if (insertErr) {
    console.error("[user-documents] assign insert failed:", insertErr.message);
    await removeUserDocFromStorage(filePath);
    return { ok: false, message: "Couldn't save the document record." };
  }

  await writeAudit({
    actorId: actor.id,
    orgId,
    action: "user_document_assigned",
    entity: "user_documents",
    payload: {
      document_id: docId,
      owner_id: targetUserId,
      title: titleV.value,
    },
  });

  revalidatePath("/app/documents");
  return { ok: true, message: "Document assigned to team member." };
}

export async function deleteUserDocument(id: string): Promise<ActionResult> {
  const profile = await requireActiveProfile();
  const db = createAdminClient();

  const { data: doc } = await db
    .from("user_documents")
    .select("*")
    .eq("id", id)
    .single();

  if (!doc) return { ok: false, message: "Document not found." };
  if (doc.source !== "personal" || doc.owner_id !== profile.id) {
    return {
      ok: false,
      message: "You can only delete your own personal uploads.",
    };
  }

  await removeUserDocFromStorage(doc.file_path);
  const { error } = await db.from("user_documents").delete().eq("id", id);
  if (error) {
    console.error("[user-documents] delete failed:", error.message);
    return { ok: false, message: "Couldn't delete the document." };
  }

  revalidatePath("/app/documents");
  return { ok: true, message: "Document deleted." };
}
