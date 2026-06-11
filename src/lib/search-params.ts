import type { ReadonlyURLSearchParams } from "next/navigation";

/** Null-safe wrapper — useSearchParams() can return null during client navigation. */
export function currentSearchParams(
  searchParams: ReadonlyURLSearchParams | null,
): URLSearchParams {
  return new URLSearchParams(searchParams?.toString() ?? "");
}
