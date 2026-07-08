import "server-only";

import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from "crypto";

const ALGO = "aes-256-gcm";
const IV_LEN = 12;
const TAG_LEN = 16;

let cachedKey: Buffer | null = null;
function key(): Buffer {
  // Memoize: scryptSync is deliberately CPU-hard and the env secret is fixed
  // for the process lifetime, so deriving it once avoids stalling the event
  // loop on every encrypt/decrypt (hot on token-decrypt and sync loops).
  if (cachedKey) return cachedKey;
  const secret = process.env.DOCUMENT_ENCRYPTION_KEY;
  if (!secret || secret.length < 16) {
    throw new Error("DOCUMENT_ENCRYPTION_KEY is not configured.");
  }
  cachedKey = scryptSync(secret, "cadence-bank-v1", 32);
  return cachedKey;
}

/** Encrypts sensitive bank fields for storage. Returns base64 payload. */
export function encryptBankField(plain: string): string {
  if (!plain.trim()) return "";
  const iv = randomBytes(IV_LEN);
  const cipher = createCipheriv(ALGO, key(), iv);
  const enc = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, tag, enc]).toString("base64");
}

/** Decrypts a stored bank field. Server-only — never send to client. */
export function decryptBankField(payload: string | null | undefined): string {
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

/** Masks a value for display — last 4 chars only. */
export function maskSensitive(value: string | null | undefined): string {
  if (!value) return "—";
  const plain = value.includes("=") || value.length > 24
    ? decryptBankField(value)
    : value;
  if (!plain) return "—";
  if (plain.length <= 4) return "••••";
  return `••••${plain.slice(-4)}`;
}
