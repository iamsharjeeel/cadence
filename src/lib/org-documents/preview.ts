import type { UserDocPreviewKind } from "@/lib/user-documents/preview";
import { userDocPreviewKind } from "@/lib/user-documents/preview";

export function officialDocPreviewKind(
  fileType: string | null | undefined,
  filePath: string | null | undefined,
): UserDocPreviewKind | null {
  const ft = fileType?.toLowerCase() ?? "";
  if (ft === "pdf") return "pdf";
  if (ft === "docx") return "docx";

  const path = filePath?.toLowerCase() ?? "";
  const name = path.split("/").pop() ?? path;
  return userDocPreviewKind(null, name);
}

export function officialDocPreviewable(
  fileType: string | null | undefined,
  filePath: string | null | undefined,
): boolean {
  return officialDocPreviewKind(fileType, filePath) !== null;
}

export function officialDocDownloadName(
  name: string,
  filePath: string,
  fileType: string | null,
): string {
  const ext = filePath.includes(".")
    ? filePath.slice(filePath.lastIndexOf("."))
    : fileType === "pdf"
      ? ".pdf"
      : fileType === "docx"
        ? ".docx"
        : "";
  if (ext && name.toLowerCase().endsWith(ext.toLowerCase())) return name;
  return `${name}${ext}`;
}
