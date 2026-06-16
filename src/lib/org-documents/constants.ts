export const ORG_DOCUMENTS_BUCKET = "org-documents";

export const ORG_DOC_MAX_BYTES = 20 * 1024 * 1024;

export const ORG_DOC_ALLOWED_EXT = [".pdf", ".docx"] as const;

export const ORG_DOC_ALLOWED_MIME = [
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
] as const;

export const ORG_DOC_CATEGORIES = [
  "contract",
  "offer_letter",
  "policy",
  "nda",
  "other",
] as const;

/** Library masters live under `{orgId}/library/...` in the org-documents bucket. */
export function isOrgLibraryPath(filePath: string): boolean {
  return filePath.includes("/library/");
}

export function bucketForOfficialDocPath(filePath: string): string {
  return isOrgLibraryPath(filePath)
    ? ORG_DOCUMENTS_BUCKET
    : "official-documents";
}

export function buildOrgLibraryPath(
  orgId: string,
  docId: string,
  fileName: string,
): string {
  const safe = fileName.replace(/[^\w.\-() ]+/g, "_").slice(0, 180) || "file";
  return `${orgId}/library/${docId}/${safe}`;
}
