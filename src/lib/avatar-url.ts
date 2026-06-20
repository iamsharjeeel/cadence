/** Preset avatar paths served from /public/avatars. */
export const AVATAR_PRESETS = [
  "/avatars/preset-1.svg",
  "/avatars/preset-2.svg",
  "/avatars/preset-3.svg",
  "/avatars/preset-4.svg",
  "/avatars/preset-5.svg",
] as const;

export type AvatarPreset = (typeof AVATAR_PRESETS)[number];

export function isAvatarPreset(path: string): path is AvatarPreset {
  return (AVATAR_PRESETS as readonly string[]).includes(path);
}

/**
 * Resolves a stored avatar_url for display.
 * - Public presets (paths starting with /) pass through unchanged.
 * - Private storage keys route through the signed-URL API route.
 */
export function resolveAvatarUrl(
  avatarUrl: string | null | undefined,
): string | null {
  if (!avatarUrl?.trim()) return null;
  const trimmed = avatarUrl.trim();
  if (trimmed.startsWith("/")) return trimmed;
  return `/api/avatar?path=${encodeURIComponent(trimmed)}`;
}
