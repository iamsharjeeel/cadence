import "server-only";

import {
  USER_DOC_ALLOWED_EXT,
  USER_DOC_ALLOWED_MIME,
  USER_DOC_MAX_BYTES,
  USER_DOC_PATH_PREFIX,
  USER_DOC_STORAGE_BUCKET,
} from "@/lib/user-documents/constants";
import { createAdminClient } from "@/lib/supabase/admin";

export type ValidatedUserDocFile = {
  fileName: string;
  mimeType: string;
  extension: string;
};

export function sanitizeFileName(name: string): string {
  const base = name.split(/[/\\]/).pop() ?? "file";
  return base.replace(/[^\w.\-() ]+/g, "_").slice(0, 180) || "file";
}

export function validateUserDocFile(
  file: File | null,
): { ok: true; file: ValidatedUserDocFile } | { ok: false; error: string } {
  if (!file?.size) {
    return { ok: false, error: "Choose a file to upload." };
  }
  if (file.size > USER_DOC_MAX_BYTES) {
    return { ok: false, error: "File must be under 10MB." };
  }

  const fileName = sanitizeFileName(file.name);
  const dot = fileName.lastIndexOf(".");
  const extension =
    dot >= 0 ? fileName.slice(dot).toLowerCase() : "";

  if (
    !USER_DOC_ALLOWED_EXT.includes(
      extension as (typeof USER_DOC_ALLOWED_EXT)[number],
    )
  ) {
    return {
      ok: false,
      error: "Unsupported file type. Use PDF, Office docs, images, or TXT.",
    };
  }

  const mimeType =
    file.type && USER_DOC_ALLOWED_MIME.includes(
      file.type as (typeof USER_DOC_ALLOWED_MIME)[number],
    )
      ? file.type
      : "application/octet-stream";

  return {
    ok: true,
    file: {
      fileName,
      mimeType,
      extension,
    },
  };
}

export async function fileToBuffer(file: File): Promise<Buffer> {
  return Buffer.from(await file.arrayBuffer());
}

export function buildUserDocStoragePath(
  ownerId: string,
  docId: string,
  fileName: string,
): string {
  return `${USER_DOC_PATH_PREFIX}/${ownerId}/${docId}-${sanitizeFileName(fileName)}`;
}

export async function uploadUserDocToStorage(
  path: string,
  buffer: Buffer,
  mimeType: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const db = createAdminClient();
  const { error } = await db.storage
    .from(USER_DOC_STORAGE_BUCKET)
    .upload(path, buffer, {
      contentType: mimeType,
      upsert: false,
    });
  if (error) {
    console.error("[user-documents] storage upload failed:", error.message);
    return { ok: false, error: "Couldn't upload the file." };
  }
  return { ok: true };
}

export async function removeUserDocFromStorage(path: string): Promise<void> {
  const db = createAdminClient();
  const { error } = await db.storage
    .from(USER_DOC_STORAGE_BUCKET)
    .remove([path]);
  if (error) {
    console.error("[user-documents] storage remove failed:", error.message);
  }
}
