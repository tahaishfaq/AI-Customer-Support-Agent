import { apiFetch } from "@/lib/api-client";

export async function getOnboarding() {
  const data = await apiFetch("/api/onboarding");
  return data.onboarding;
}

export async function submitOnboarding(body) {
  const data = await apiFetch("/api/onboarding", {
    method: "POST",
    body: JSON.stringify(body),
  });
  return data;
}

export async function kickOnboardingCrawl() {
  const data = await apiFetch("/api/onboarding/crawl", {
    method: "POST",
    body: JSON.stringify({}),
  });
  return data;
}

/** Plans page: create SafePay customer while user browses plans. */
export async function ensureSafepayCustomer() {
  const data = await apiFetch("/api/onboarding/safepay-customer", {
    method: "POST",
    body: JSON.stringify({}),
  });
  return data;
}
