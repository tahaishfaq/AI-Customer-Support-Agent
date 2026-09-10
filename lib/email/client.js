import { Resend } from "resend";

let client = null;

export function isEmailConfigured() {
  return Boolean(process.env.RESEND_API_KEY?.trim() && process.env.EMAIL_FROM?.trim());
}

export function isEmailTestMode() {
  return process.env.EMAIL_TEST_MODE === "1" || process.env.EMAIL_TEST_MODE === "true";
}

/** Production must have Resend; test mode bypasses for automated suites. */
export function requireEmailConfigured() {
  if (isEmailTestMode()) return true;
  if (isEmailConfigured()) return true;
  if (process.env.NODE_ENV === "production") return false;
  return true; // dev: mock send allowed
}

export function getEmailFrom() {
  return process.env.EMAIL_FROM?.trim() || "Aide <noreply@localhost>";
}

export function getEmailReplyTo() {
  const v = process.env.EMAIL_REPLY_TO?.trim();
  return v || undefined;
}

export function getResendClient() {
  const key = process.env.RESEND_API_KEY?.trim();
  if (!key) return null;
  if (!client) client = new Resend(key);
  return client;
}

/** Reset singleton between tests. */
export function resetResendClientForTests() {
  client = null;
}
