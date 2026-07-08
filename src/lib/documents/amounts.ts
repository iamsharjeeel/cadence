/**
 * Rounds a dollar amount to the nearest cent.
 *
 * Plain `Math.round(x * 100) / 100` mis-rounds values that land on (or near)
 * a half-cent boundary because the multiplication can't be represented
 * exactly in binary floating point (e.g. `1.005 * 100 === 100.49999999999999`,
 * which rounds down to `1` instead of `1.01`). Re-rendering the intermediate
 * value through `toPrecision(15)` strips that binary noise before rounding,
 * which recovers the decimal value the caller actually intended regardless
 * of magnitude.
 */
function roundToCents(amount: number): number {
  return Math.round(Number((amount * 100).toPrecision(15))) / 100;
}

/** Computes subtotal, GST, and total from an approved timesheet subtotal. */
export function computeDocumentAmounts(
  subtotal: number,
  gstEnabled: boolean,
  gstRate: number,
): { subtotal: number; gst_amount: number; total: number } {
  const base = roundToCents(subtotal);
  const gst = gstEnabled ? roundToCents(base * gstRate) : 0;
  return {
    subtotal: base,
    gst_amount: gst,
    total: roundToCents(base + gst),
  };
}
