/** Computes subtotal, GST, and total from an approved timesheet subtotal. */
export function computeDocumentAmounts(
  subtotal: number,
  gstEnabled: boolean,
  gstRate: number,
): { subtotal: number; gst_amount: number; total: number } {
  const base = Math.round(subtotal * 100) / 100;
  const gst = gstEnabled
    ? Math.round(base * gstRate * 100) / 100
    : 0;
  return {
    subtotal: base,
    gst_amount: gst,
    total: Math.round((base + gst) * 100) / 100,
  };
}
