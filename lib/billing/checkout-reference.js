/** SafePay may append `?plan_id=…` onto redirect URLs — keep only the checkout UUID. */
export function normalizeCheckoutReference(raw) {
  if (!raw || typeof raw !== "string") return null;
  const trimmed = raw.trim();
  const match = trimmed.match(
    /^([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})/i
  );
  if (match) return match[1].toLowerCase();
  const head = trimmed.split(/[?&#]/)[0]?.trim();
  return head || null;
}
