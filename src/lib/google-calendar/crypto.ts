import "server-only";

import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from "crypto";

const ALGO = "aes-256-gcm";
const IV_LEN = 12;
const TAG_LEN = 16;

function key(): Buffer {
  const secret = process.env.DOCUMENT_ENCRYPTION_KEY;
  if (!secret || secret.length < 16) {
    throw new Error("DOCUMENT_ENCRYPTION_KEY is not configured.");
  }
  return scryptSync(secret, "cadence-gcal-v1", 32);
}

/** Encrypts Google Calendar OAuth tokens for storage. Returns base64 payload. */
export function encryptGCalToken(plain: string): string {
  if (!plain.trim()) return "";
  const iv = randomBytes(IV_LEN);
  const cipher = createCipheriv(ALGO, key(), iv);
  const enc = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, tag, enc]).toString("base64");
}

/** Decrypts a stored Google Calendar token. Server-only — never send to client. */
export function decryptGCalToken(payload: string | null | undefined): string {
  if (!payload) return "";
  const buf = Buffer.from(payload, "base64");
  if (buf.length < IV_LEN + TAG_LEN + 1) return "";
  const iv = buf.subarray(0, IV_LEN);
  const tag = buf.subarray(IV_LEN, IV_LEN + TAG_LEN);
  const data = buf.subarray(IV_LEN + TAG_LEN);
  const decipher = createDecipheriv(ALGO, key(), iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(data), decipher.final()]).toString(
    "utf8",
  );
}
