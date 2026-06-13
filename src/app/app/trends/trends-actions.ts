"use server";

import { requireActiveProfile } from "@/lib/auth";
import {
  getTrendsBundle,
  type TrendRange,
  type TrendsBundle,
} from "@/lib/time/trends";

const RANGES: TrendRange[] = [
  "weekly",
  "fortnightly",
  "monthly",
  "6month",
  "yearly",
];

/**
 * Client-callable trend fetch — lets the trends filters update charts in place
 * (no navigation / full page reload). Role + org scoping enforced server-side.
 */
export async function fetchTrendsData(
  range: string,
  orgId?: string,
): Promise<TrendsBundle> {
  const profile = await requireActiveProfile();
  const safeRange = (RANGES.includes(range as TrendRange) ? range : "monthly") as TrendRange;
  return getTrendsBundle(profile, safeRange, orgId);
}
