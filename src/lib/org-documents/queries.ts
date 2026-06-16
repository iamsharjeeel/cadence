import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";
import {
  bucketForOfficialDocPath,
  ORG_DOCUMENTS_BUCKET,
} from "@/lib/org-documents/constants";
import type { OfficialDocument } from "@/types/db";

export type OrgLibraryDocument = OfficialDocument;

export async function listOrgLibraryDocuments(
  orgId: string,
): Promise<OrgLibraryDocument[]> {
  const db = createAdminClient();
  const { data } = await db
    .from("official_documents")
    .select("*")
    .eq("org_id", orgId)
    .is("employee_id", null)
    .order("created_at", { ascending: false });
  return (data ?? []) as OrgLibraryDocument[];
}

export async function listAssignedOfficialDocumentsForMember(
  employeeId: string,
): Promise<OfficialDocument[]> {
  const db = createAdminClient();
  const { data } = await db
    .from("official_documents")
    .select("*")
    .eq("employee_id", employeeId)
    .not("org_id", "is", null)
    .like("file_path", "%/library/%")
    .order("created_at", { ascending: false });
  return (data ?? []) as OfficialDocument[];
}

export async function signedUrlsForOfficialDocuments(
  docs: Pick<OfficialDocument, "id" | "file_path">[],
): Promise<Record<string, string>> {
  const db = createAdminClient();
  const urls: Record<string, string> = {};
  await Promise.all(
    docs.map(async (d) => {
      const bucket = bucketForOfficialDocPath(d.file_path);
      const { data: signed } = await db.storage
        .from(bucket)
        .createSignedUrl(d.file_path, 60 * 60);
      if (signed?.signedUrl) urls[d.id] = signed.signedUrl;
    }),
  );
  return urls;
}

export async function listOrgMembersForOfficialAssign(
  orgId: string,
): Promise<{ id: string; name: string }[]> {
  const db = createAdminClient();
  const { data: memRows } = await db
    .from("memberships")
    .select("user_id")
    .eq("org_id", orgId);

  const memberIds = (memRows ?? []).map((m) => m.user_id as string);
  if (!memberIds.length) return [];

  const { data: people } = await db
    .from("profiles")
    .select("id, full_name, email")
    .in("id", memberIds)
    .order("full_name");

  return (people ?? []).map((p) => ({
    id: p.id,
    name: p.full_name?.trim() || p.email,
  }));
}

export { ORG_DOCUMENTS_BUCKET };
