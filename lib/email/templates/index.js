import { EMAIL_TEMPLATES } from "@/lib/email/constants";
import {
  renderPasswordResetOtp,
  renderLandingContactAdmin,
  renderLandingContactAck,
  renderCustomPlanAdmin,
  renderCustomPlanAck,
  renderPlanSubscribed,
  renderPlanChanged,
  renderPlanRenewalUpcoming,
  renderPlanRenewed,
  renderSubscriptionPastDue,
  renderSubscriptionCancelScheduled,
  renderSubscriptionCanceled,
  renderPaymentReceipt,
  renderWelcome,
  renderVerifyEmail,
  renderOnboardingDay1,
  renderLoginAlert,
} from "@/lib/email/templates/render";

const REGISTRY = {
  [EMAIL_TEMPLATES.PASSWORD_RESET_OTP]: renderPasswordResetOtp,
  [EMAIL_TEMPLATES.LANDING_CONTACT_ADMIN]: renderLandingContactAdmin,
  [EMAIL_TEMPLATES.LANDING_CONTACT_ACK]: renderLandingContactAck,
  [EMAIL_TEMPLATES.CUSTOM_PLAN_REQUEST_ADMIN]: renderCustomPlanAdmin,
  [EMAIL_TEMPLATES.CUSTOM_PLAN_REQUEST_ACK]: renderCustomPlanAck,
  [EMAIL_TEMPLATES.PLAN_SUBSCRIBED]: renderPlanSubscribed,
  [EMAIL_TEMPLATES.PLAN_CHANGED]: renderPlanChanged,
  [EMAIL_TEMPLATES.PLAN_RENEWAL_UPCOMING]: renderPlanRenewalUpcoming,
  [EMAIL_TEMPLATES.PLAN_RENEWED]: renderPlanRenewed,
  [EMAIL_TEMPLATES.SUBSCRIPTION_PAST_DUE]: renderSubscriptionPastDue,
  [EMAIL_TEMPLATES.SUBSCRIPTION_CANCEL_SCHEDULED]: renderSubscriptionCancelScheduled,
  [EMAIL_TEMPLATES.SUBSCRIPTION_CANCELED]: renderSubscriptionCanceled,
  [EMAIL_TEMPLATES.PAYMENT_RECEIPT]: renderPaymentReceipt,
  [EMAIL_TEMPLATES.WELCOME]: renderWelcome,
  [EMAIL_TEMPLATES.VERIFY_EMAIL]: renderVerifyEmail,
  [EMAIL_TEMPLATES.ONBOARDING_DAY1]: renderOnboardingDay1,
  [EMAIL_TEMPLATES.LOGIN_ALERT]: renderLoginAlert,
};

export function renderTemplate(template, data = {}) {
  const fn = REGISTRY[template];
  if (!fn) {
    const err = new Error(`Unknown email template: ${template}`);
    err.code = "EMAIL_UNKNOWN_TEMPLATE";
    throw err;
  }
  return fn(data);
}

export function listRegisteredTemplates() {
  return Object.keys(REGISTRY);
}
