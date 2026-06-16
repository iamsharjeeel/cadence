export const USER_DOC_MAX_BYTES = 10 * 1024 * 1024;

export const USER_DOC_ALLOWED_EXT = [
  ".pdf",
  ".doc",
  ".docx",
  ".xls",
  ".xlsx",
  ".txt",
  ".png",
  ".jpg",
  ".jpeg",
  ".webp",
  ".gif",
] as const;

export const USER_DOC_ALLOWED_MIME = [
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "text/plain",
  "image/png",
  "image/jpeg",
  "image/webp",
  "image/gif",
] as const;

export const USER_DOC_STORAGE_BUCKET = "documents";
export const USER_DOC_PATH_PREFIX = "user-docs";

export type UserDocumentSource = "personal" | "org_assigned";
