/**
 * Checkout mode flag.
 * - legacy (default): hosted Safepay createSubscription
 * - atoms: in-AIDE Atoms first payment (ATOMS_HYBRID)
 */
export function getBillingCheckoutMode() {
  const raw = String(process.env.BILLING_CHECKOUT_MODE || "legacy")
    .trim()
    .toLowerCase();
  return raw === "atoms" ? "atoms" : "legacy";
}

export function isAtomsCheckoutEnabled() {
  return getBillingCheckoutMode() === "atoms";
}
