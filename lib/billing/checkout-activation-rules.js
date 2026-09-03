/** Pure rules for when a checkout still needs server-side activation. */
export function subscriptionAwaitingCheckoutActivation(subscription) {
  if (!subscription) return false;
  if (subscription.status === "PENDING" || subscription.status === "PAST_DUE") {
    return true;
  }
  return (
    subscription.status === "ACTIVE" &&
    Boolean(subscription.pendingPlanId) &&
    Boolean(subscription.checkoutReference)
  );
}
