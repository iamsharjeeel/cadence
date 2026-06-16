export type UserDocPreviewKind = "pdf" | "image" | "docx";

const IMAGE_EXT = new Set([".png", ".jpg", ".jpeg", ".webp", ".gif"]);
const IMAGE_MIME = new Set([
  "image/png",
  "image/jpeg",
  "image/webp",
  "image/gif",
]);

const DOCX_MIME =
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document";

export function userDocPreviewKind(
  mimeType: string | null | undefined,
  fileName: string | null | undefined,
): UserDocPreviewKind | null {
  const mime = mimeType?.toLowerCase() ?? "";
  if (mime === "application/pdf") return "pdf";
  if (IMAGE_MIME.has(mime)) return "image";
  if (mime === DOCX_MIME || mime === "application/msword") {
    return mime === DOCX_MIME ? "docx" : null;
  }

  const name = fileName?.toLowerCase() ?? "";
  const dot = name.lastIndexOf(".");
  const ext = dot >= 0 ? name.slice(dot) : "";
  if (ext === ".pdf") return "pdf";
  if (IMAGE_EXT.has(ext)) return "image";
  if (ext === ".docx") return "docx";

  return null;
}

export function userDocPreviewable(
  mimeType: string | null | undefined,
  fileName: string | null | undefined,
): boolean {
  return userDocPreviewKind(mimeType, fileName) !== null;
}
