/**
 * AIDE BillingPlan.priceMinor = whole currency units (PKR rupees), per BILLING_SAFEPAY.md.
 * Safepay Payments /order/payments/v3 amount = lowest denomination (paisa / cents).
 * Example: Rs 3500 → Safepay amount 350000.
 */
export function planPriceToSafepayAmount(priceWholeUnits) {
  const n = Math.round(Number(priceWholeUnits) || 0);
  if (n < 0) return 0;
  return n * 100;
}

export function safepayAmountToPlanPrice(safepayAmount) {
  const n = Math.round(Number(safepayAmount) || 0);
  return Math.round(n / 100);
}
