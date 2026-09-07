/** Template ids — keep in sync with docs/features/EMAIL_RESEND_PLAN.md */

export const EMAIL_TEMPLATES = Object.freeze({
  PASSWORD_RESET_OTP: "password_reset_otp",
  WELCOME: "welcome",
  VERIFY_EMAIL: "verify_email",
  CUSTOM_PLAN_REQUEST_ADMIN: "custom_plan_request_admin",
  CUSTOM_PLAN_REQUEST_ACK: "custom_plan_request_ack",
  LANDING_CONTACT_ADMIN: "landing_contact_admin",
  LANDING_CONTACT_ACK: "landing_contact_ack",
  PLAN_SUBSCRIBED: "plan_subscribed",
  PLAN_CHANGED: "plan_changed",
  PLAN_RENEWAL_UPCOMING: "plan_renewal_upcoming",
  PLAN_RENEWED: "plan_renewed",
  SUBSCRIPTION_PAST_DUE: "subscription_past_due",
  SUBSCRIPTION_CANCEL_SCHEDULED: "subscription_cancel_scheduled",
  SUBSCRIPTION_CANCELED: "subscription_canceled",
  PAYMENT_RECEIPT: "payment_receipt",
  ONBOARDING_DAY1: "onboarding_day1",
  PRODUCT_UPDATE: "product_update",
  LOGIN_ALERT: "login_alert",
});

export const EMAIL_TOKEN_TYPES = Object.freeze({
  VERIFY_EMAIL: "VERIFY_EMAIL",
  PASSWORD_RESET_OTP: "PASSWORD_RESET_OTP",
  PASSWORD_RESET_TICKET: "PASSWORD_RESET_TICKET",
});

/** Locked: 5 minutes for password-reset OTP. */
export function resetOtpTtlSec() {
  const n = Number(process.env.EMAIL_RESET_OTP_TTL_SEC);
  if (Number.isFinite(n) && n >= 60 && n <= 3600) return Math.trunc(n);
  return 300;
}

export function resetOtpMaxAttempts() {
  const n = Number(process.env.EMAIL_RESET_OTP_MAX_ATTEMPTS);
  if (Number.isFinite(n) && n >= 1 && n <= 20) return Math.trunc(n);
  return 5;
}

export function resetOtpResendCooldownSec() {
  const n = Number(process.env.EMAIL_RESET_RESEND_COOLDOWN_SEC);
  if (Number.isFinite(n) && n >= 15 && n <= 600) return Math.trunc(n);
  return 60;
}

/** Soft verify link TTL — default 24h. */
export function verifyEmailTtlSec() {
  const n = Number(process.env.EMAIL_VERIFY_TTL_SEC);
  if (Number.isFinite(n) && n >= 3600 && n <= 7 * 86400) return Math.trunc(n);
  return 86400;
}

export function isEmailVerificationRequired() {
  const v = process.env.EMAIL_VERIFICATION_REQUIRED;
  return v === "1" || v === "true";
}

export function isEmailOnboardingDripEnabled() {
  const v = process.env.EMAIL_ONBOARDING_DRIP;
  if (v === "0" || v === "false") return false;
  return true; // default on for EM3
}

export function isEmailLoginAlertsEnabled() {
  const v = process.env.EMAIL_LOGIN_ALERTS;
  return v === "1" || v === "true";
}

export function billingAdminEmails() {
  const raw = process.env.BILLING_ADMIN_EMAIL || "";
  return raw
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
}
