import { apiFetch } from "@/lib/api-client";

export async function getBillingPlans() {
  const data = await apiFetch("/api/billing/plans");
  return {
    plans: data.plans || [],
    paymentsAvailable: Boolean(data.paymentsAvailable),
  };
}

export async function getBillingStatus() {
  const data = await apiFetch("/api/billing/status");
  return {
    billing: data.billing,
    conversations: data.conversations || null,
  };
}

export async function reconcileBillingCheckout(reference, subscriptionToken) {
  const data = await apiFetch("/api/billing/reconcile", {
    method: "POST",
    body: JSON.stringify({
      ...(reference ? { reference } : {}),
      ...(subscriptionToken ? { subscriptionToken } : {}),
    }),
  });
  return data;
}

export async function subscribeFreePlan(planId) {
  const data = await apiFetch("/api/billing/subscribe", {
    method: "POST",
    body: JSON.stringify({ planId }),
  });
  return data;
}

export async function startPaidCheckout(planId) {
  const data = await apiFetch("/api/billing/checkout", {
    method: "POST",
    body: JSON.stringify({ planId }),
  });
  return data;
}

export async function cancelSubscription() {
  const data = await apiFetch("/api/billing/cancel", {
    method: "POST",
    body: JSON.stringify({}),
  });
  return data;
}

export async function submitCustomPlanRequest(body) {
  const data = await apiFetch("/api/billing/custom-request", {
    method: "POST",
    body: JSON.stringify(body),
  });
  return data;
}
