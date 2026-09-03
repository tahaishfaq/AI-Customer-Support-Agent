import { Safepay } from "@sfpy/node-sdk";

let cached = null;

export function isSafepayConfigured() {
  const env = process.env.SAFEPAY_ENVIRONMENT?.trim();
  const apiKey = process.env.SAFEPAY_API_KEY?.trim();
  const webhookSecret = process.env.SAFEPAY_WEBHOOK_SECRET?.trim();
  const v1Secret = process.env.SAFEPAY_V1_SECRET?.trim();
  return Boolean(
    env &&
      apiKey &&
      webhookSecret &&
      v1Secret &&
      ["sandbox", "production", "development"].includes(env)
  );
}

export function getSafepayClient() {
  if (!isSafepayConfigured()) {
    const err = new Error("SafePay is not configured");
    err.status = 503;
    err.code = "safepay_not_configured";
    throw err;
  }
  if (!cached) {
    cached = new Safepay({
      environment: process.env.SAFEPAY_ENVIRONMENT.trim(),
      apiKey: process.env.SAFEPAY_API_KEY.trim(),
      webhookSecret: process.env.SAFEPAY_WEBHOOK_SECRET.trim(),
      v1Secret: process.env.SAFEPAY_V1_SECRET.trim(),
    });
  }
  return cached;
}
