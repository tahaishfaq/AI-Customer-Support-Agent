import axios from "axios";
import { isSafepayConfigured } from "@/lib/billing/safepay-client";

function apiHost(environment) {
  const env = environment?.trim() || "sandbox";
  const hosts = {
    development: "https://dev.api.getsafepay.com",
    sandbox: "https://sandbox.api.getsafepay.com",
    production: "https://api.getsafepay.com",
  };
  return hosts[env] || hosts.sandbox;
}

function unwrap(response) {
  return response?.data?.data ?? response?.data ?? null;
}

/**
 * Create a SafePay customer (guest) for prefill / future checkout attach.
 * Uses REST — not in @sfpy/node-sdk yet.
 * @returns {Promise<{ token: string } | null>}
 */
export async function createSafepayCustomer({
  firstName,
  lastName,
  email,
  phone,
  country = "PK",
}) {
  if (!isSafepayConfigured()) return null;

  const secret = process.env.SAFEPAY_V1_SECRET?.trim();
  const host = apiHost(process.env.SAFEPAY_ENVIRONMENT);
  const payload = {
    first_name: String(firstName || "").trim(),
    last_name: String(lastName || "").trim(),
    email: String(email || "").trim().toLowerCase(),
    phone_number: String(phone || "").replace(/\s+/g, " ").trim(),
    country: String(country || "PK").trim().toUpperCase().slice(0, 2),
    is_guest: true,
  };

  if (!payload.first_name || !payload.last_name || !payload.email || !payload.phone_number) {
    const err = new Error("Missing fields for SafePay customer");
    err.status = 400;
    throw err;
  }

  const response = await axios.post(
    `${host}/user/customers/v1/`,
    payload,
    {
      headers: {
        "Content-Type": "application/json",
        "X-SFPY-MERCHANT-SECRET": secret,
        Authorization: `Bearer ${secret}`,
      },
      timeout: 15000,
      validateStatus: (status) => status < 500,
    }
  );

  if (response.status >= 400) {
    const message =
      response.data?.status?.message ||
      response.data?.message ||
      `SafePay customer create failed (${response.status})`;
    const err = new Error(message);
    err.status = 502;
    err.code = "safepay_customer_failed";
    err.details = response.data;
    throw err;
  }

  const data = unwrap(response);
  const token = data?.token || data?.id || null;
  if (!token) {
    const err = new Error("SafePay customer create returned no token");
    err.status = 502;
    err.code = "safepay_customer_failed";
    throw err;
  }

  return { token: String(token), raw: data };
}
