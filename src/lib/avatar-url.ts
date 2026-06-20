/**
 * Resolves a profiles.avatar_url value to a displayable URL.
 *
 * Two kinds of values live in avatar_url:
 *  - Preset SVGs:  "/avatars/preset-N.svg"  → start with "/" → served directly from /public
 *  - Uploaded files: "{userId}/avatar.{ext}" → storage path → proxy through /api/avatar
 *  - Blob previews: "blob:..."               → local object URL → used directly
 */
export function resolveAvatarUrl(avatarUrl: string | null | undefined): string | null {
  if (!avatarUrl) return null;
  // Local paths (presets from /public/avatars/) and blob preview URLs need no translation
  if (avatarUrl.startsWith("/") || avatarUrl.startsWith("blob:")) return avatarUrl;
  // Everything else is a private Supabase Storage path — proxy through our API route
  return `/api/avatar?path=${encodeURIComponent(avatarUrl)}`;
}
