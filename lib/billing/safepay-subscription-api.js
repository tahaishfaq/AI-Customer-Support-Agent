import axios from "axios";

function subscriptionApiBaseUrl(environment) {
  const env = environment?.trim() || "sandbox";
  const hosts = {
    development: "https://dev.api.getsafepay.com/client",
    sandbox: "https://sandbox.api.getsafepay.com/client",
    production: "https://api.getsafepay.com/client",
  };
  return hosts[env] || hosts.sandbox;
}

function merchantHeaders() {
  return {
    "X-SFPY-MERCHANT-SECRET": process.env.SAFEPAY_V1_SECRET?.trim() || "",
  };
}

function unwrapSafepayData(response) {
  return response?.data?.data ?? response?.data ?? null;
}

export function safepaySubscriptionLooksPaid(record) {
  if (!record || typeof record !== "object") return false;

  const status = String(
    record.status || record.state || record.subscription_status || ""
  ).toLowerCase();

  if (["active", "paid", "complete", "completed", "trialing"].includes(status)) {
    return true;
  }

  if (record.latest_invoice?.paid === true) return true;
  if (record.last_payment_status === "paid") return true;
  if (record.paid === true) return true;

  const payments = record.payments || record.transactions;
  if (Array.isArray(payments) && payments.length > 0) {
    return payments.some((payment) => {
      const paymentStatus = String(payment?.status || payment?.state || "").toLowerCase();
      return ["paid", "complete", "completed", "succeeded", "success"].includes(
        paymentStatus
      );
    });
  }

  return false;
}

async function getSubscription(path, params) {
  const environment = process.env.SAFEPAY_ENVIRONMENT?.trim();
  const response = await axios.get(path, {
    baseURL: subscriptionApiBaseUrl(environment),
    headers: merchantHeaders(),
    params,
    timeout: 15000,
    validateStatus: (status) => status < 500,
  });

  if (response.status >= 400) return null;
  return unwrapSafepayData(response);
}

export async function fetchSafepaySubscriptionByToken(token) {
  if (!token?.trim()) return null;
  const id = token.trim();
  return getSubscription(`/subscriptions/v1/${encodeURIComponent(id)}`);
}

export async function fetchSafepaySubscriptionByReference(reference) {
  if (!reference?.trim()) return null;

  const byQuery = await getSubscription("/subscriptions/v1", {
    reference: reference.trim(),
  });
  if (byQuery) return byQuery;

  return getSubscription(
    `/subscriptions/v1/reference/${encodeURIComponent(reference.trim())}`
  );
}
