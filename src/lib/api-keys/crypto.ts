import "server-only";

import crypto from "crypto";

export const API_KEY_PREFIX = "cad_live_";

export function generateApiKeyRaw(): string {
  return API_KEY_PREFIX + crypto.randomBytes(32).toString("hex");
}

export function hashApiKey(key: string): string {
  return crypto.createHash("sha256").update(key).digest("hex");
}

export function keyDisplayPrefix(fullKey: string): string {
  return fullKey.slice(0, 12);
}
