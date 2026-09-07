import { layout, escapeHtml } from "./layout.js";

export function renderPasswordResetOtp(data) {
  const name = data.name || "there";
  const code = String(data.code || "");
  const minutes = data.expiresMinutes ?? 5;
  const subject = "Your password reset code";
  const text = `Hi ${name},\n\nYour AIDE password reset code is ${code}. It expires in ${minutes} minutes.\n\nIf you did not request this, you can ignore this email.\n`;
  const html = layout({
    title: "Password reset code",
    preheader: `Code expires in ${minutes} minutes`,
    bodyHtml: `
      <p style="margin:0 0 12px;font-size:15px;line-height:1.5;">Hi ${escapeHtml(name)},</p>
      <p style="margin:0 0 16px;font-size:15px;line-height:1.5;">Use this code to reset your password. It expires in <strong>${escapeHtml(minutes)}</strong> minutes.</p>
      <p style="margin:0 0 20px;font-size:28px;letter-spacing:0.28em;font-weight:700;font-family:ui-monospace,Menlo,monospace;">${escapeHtml(code)}</p>
      <p style="margin:0;font-size:13px;line-height:1.5;color:#6b665c;">If you did not request a reset, ignore this email.</p>
    `,
  });
  return { subject, html, text };
}

export function renderLandingContactAdmin(data) {
  const subject = `Landing contact — ${data.fullName || "visitor"}`;
  const text = `From: ${data.fullName} <${data.email}>\nCompany: ${data.company || "—"}\n\n${data.message}\n`;
  const html = layout({
    title: "Landing contact",
    bodyHtml: `
      <p style="margin:0 0 8px;font-size:14px;"><strong>Name:</strong> ${escapeHtml(data.fullName)}</p>
      <p style="margin:0 0 8px;font-size:14px;"><strong>Email:</strong> ${escapeHtml(data.email)}</p>
      <p style="margin:0 0 8px;font-size:14px;"><strong>Company:</strong> ${escapeHtml(data.company || "—")}</p>
      <p style="margin:16px 0 0;font-size:15px;line-height:1.55;white-space:pre-wrap;">${escapeHtml(data.message)}</p>
    `,
  });
  return { subject, html, text };
}

export function renderLandingContactAck(data) {
  const name = data.fullName || "there";
  const subject = "We received your message";
  const text = `Hi ${name},\n\nThanks for contacting AIDE. Our team will reply soon.\n`;
  const html = layout({
    title: "Message received",
    bodyHtml: `
      <p style="margin:0 0 12px;font-size:15px;line-height:1.5;">Hi ${escapeHtml(name)},</p>
      <p style="margin:0;font-size:15px;line-height:1.5;">Thanks for reaching out. We got your message and will get back to you soon.</p>
    `,
  });
  return { subject, html, text };
}

export function renderCustomPlanAdmin(data) {
  const subject = `Custom plan request — ${data.companyName || data.contactName || data.contactEmail}`;
  const text = `Request ${data.requestId}\nContact: ${data.contactName} <${data.contactEmail}>\nCompany: ${data.companyName || "—"}\nSeats: ${data.estimatedSeats || "—"}\n\n${data.message}\n`;
  const html = layout({
    title: "Custom plan request",
    bodyHtml: `
      <p style="margin:0 0 8px;font-size:14px;"><strong>Request:</strong> ${escapeHtml(data.requestId)}</p>
      <p style="margin:0 0 8px;font-size:14px;"><strong>Contact:</strong> ${escapeHtml(data.contactName)} &lt;${escapeHtml(data.contactEmail)}&gt;</p>
      <p style="margin:0 0 8px;font-size:14px;"><strong>Company:</strong> ${escapeHtml(data.companyName || "—")}</p>
      <p style="margin:0 0 8px;font-size:14px;"><strong>Seats:</strong> ${escapeHtml(data.estimatedSeats || "—")}</p>
      <p style="margin:0 0 8px;font-size:14px;"><strong>Use case:</strong> ${escapeHtml(data.useCase || "—")}</p>
      <p style="margin:16px 0 0;font-size:15px;line-height:1.55;white-space:pre-wrap;">${escapeHtml(data.message)}</p>
    `,
  });
  return { subject, html, text };
}

export function renderCustomPlanAck(data) {
  const name = data.contactName || "there";
  const subject = "We received your custom plan request";
  const text = `Hi ${name},\n\nThanks for your custom plan request. Our team will follow up shortly.\n`;
  const html = layout({
    title: "Custom plan request received",
    bodyHtml: `
      <p style="margin:0 0 12px;font-size:15px;line-height:1.5;">Hi ${escapeHtml(name)},</p>
      <p style="margin:0;font-size:15px;line-height:1.5;">Thanks — we received your custom plan request and will follow up shortly.</p>
    `,
  });
  return { subject, html, text };
}

function planBody({ greeting, lines, ctaLabel, ctaUrl }) {
  const lineHtml = lines
    .map(
      (line) =>
        `<p style="margin:0 0 8px;font-size:15px;line-height:1.5;">${escapeHtml(line)}</p>`
    )
    .join("");
  const cta =
    ctaUrl && ctaLabel
      ? `<p style="margin:20px 0 0;"><a href="${escapeHtml(ctaUrl)}" style="display:inline-block;background:#1c1917;color:#fffef9;text-decoration:none;padding:10px 16px;border-radius:8px;font-size:14px;">${escapeHtml(ctaLabel)}</a></p>`
      : "";
  return `
    <p style="margin:0 0 12px;font-size:15px;line-height:1.5;">${escapeHtml(greeting)}</p>
    ${lineHtml}
    ${cta}
  `;
}

export function renderPlanSubscribed(data) {
  const subject = `You're on ${data.planName || "AIDE"}`;
  const text = `Hi ${data.name || "there"},\n\nYour ${data.planName} plan is active.\n${data.manageUrl || ""}\n`;
  const html = layout({
    title: "Plan activated",
    bodyHtml: planBody({
      greeting: `Hi ${data.name || "there"},`,
      lines: [
        `Your ${data.planName || "plan"} is now active.`,
        data.priceLine || null,
        "Your workspace is unlocked — build and deploy support agents anytime.",
      ].filter(Boolean),
      ctaLabel: "Open dashboard",
      ctaUrl: data.dashboardUrl,
    }),
  });
  return { subject, html, text };
}

export function renderPlanChanged(data) {
  const subject = `Plan updated — ${data.planName || "AIDE"}`;
  const text = `Hi ${data.name || "there"},\n\nYour plan is now ${data.planName}.\n`;
  const html = layout({
    title: "Plan changed",
    bodyHtml: planBody({
      greeting: `Hi ${data.name || "there"},`,
      lines: [
        `Your subscription is now on ${data.planName || "the new plan"}.`,
        data.priceLine || null,
      ].filter(Boolean),
      ctaLabel: "View plans",
      ctaUrl: data.plansUrl,
    }),
  });
  return { subject, html, text };
}

export function renderPlanRenewalUpcoming(data) {
  const subject = `Renewal coming up — ${data.planName || "AIDE"}`;
  const text = `Hi ${data.name || "there"},\n\nYour ${data.planName} renews on ${data.renewDate}.\nManage: ${data.billingUrl || ""}\n`;
  const html = layout({
    title: "Upcoming renewal",
    bodyHtml: planBody({
      greeting: `Hi ${data.name || "there"},`,
      lines: [
        `Your ${data.planName || "plan"} renews on ${data.renewDate || "the upcoming date"}.`,
        data.priceLine || null,
      ].filter(Boolean),
      ctaLabel: "Manage billing",
      ctaUrl: data.billingUrl,
    }),
  });
  return { subject, html, text };
}

export function renderPlanRenewed(data) {
  const subject = `Renewed — ${data.planName || "AIDE"}`;
  const text = `Hi ${data.name || "there"},\n\nYour ${data.planName} plan renewed successfully.\n`;
  const html = layout({
    title: "Plan renewed",
    bodyHtml: planBody({
      greeting: `Hi ${data.name || "there"},`,
      lines: [
        `Your ${data.planName || "plan"} renewed successfully.`,
        data.priceLine || null,
      ].filter(Boolean),
      ctaLabel: "Manage billing",
      ctaUrl: data.billingUrl,
    }),
  });
  return { subject, html, text };
}

export function renderSubscriptionPastDue(data) {
  const subject = "Payment failed — update billing";
  const text = `Hi ${data.name || "there"},\n\nWe could not renew ${data.planName}. Update billing: ${data.billingUrl || ""}\n`;
  const html = layout({
    title: "Payment failed",
    bodyHtml: planBody({
      greeting: `Hi ${data.name || "there"},`,
      lines: [
        `We could not process payment for ${data.planName || "your plan"}.`,
        "Update your billing details to keep access.",
      ],
      ctaLabel: "Update billing",
      ctaUrl: data.billingUrl,
    }),
  });
  return { subject, html, text };
}

export function renderSubscriptionCancelScheduled(data) {
  const subject = "Cancellation scheduled";
  const text = `Hi ${data.name || "there"},\n\nYour ${data.planName} stays active until ${data.periodEnd}.\n`;
  const html = layout({
    title: "Cancellation scheduled",
    bodyHtml: planBody({
      greeting: `Hi ${data.name || "there"},`,
      lines: [
        `Your ${data.planName || "plan"} will remain active until ${data.periodEnd || "the end of the period"}.`,
        "You can resume from billing settings before then.",
      ],
      ctaLabel: "Manage billing",
      ctaUrl: data.billingUrl,
    }),
  });
  return { subject, html, text };
}

export function renderSubscriptionCanceled(data) {
  const subject = "Subscription ended";
  const text = `Hi ${data.name || "there"},\n\nYour paid subscription has ended. Pick a plan: ${data.plansUrl || ""}\n`;
  const html = layout({
    title: "Subscription ended",
    bodyHtml: planBody({
      greeting: `Hi ${data.name || "there"},`,
      lines: [
        "Your paid subscription has ended.",
        "Choose a plan anytime to unlock the full workspace again.",
      ],
      ctaLabel: "View plans",
      ctaUrl: data.plansUrl,
    }),
  });
  return { subject, html, text };
}

export function renderPaymentReceipt(data) {
  const subject = `Receipt — ${data.planName || "AIDE"}`;
  const text = `Hi ${data.name || "there"},\n\nPayment received for ${data.planName}. ${data.priceLine || ""}\n`;
  const html = layout({
    title: "Payment receipt",
    bodyHtml: planBody({
      greeting: `Hi ${data.name || "there"},`,
      lines: [
        `We received payment for ${data.planName || "your plan"}.`,
        data.priceLine || null,
        data.reference ? `Reference: ${data.reference}` : null,
      ].filter(Boolean),
      ctaLabel: "Manage billing",
      ctaUrl: data.billingUrl,
    }),
  });
  return { subject, html, text };
}

export function renderWelcome(data) {
  const name = data.name || "there";
  const subject = "Welcome to AIDE";
  const text = `Hi ${name},\n\nWelcome to AIDE — build grounded support agents for your site.\n${data.dashboardUrl || ""}\n`;
  const html = layout({
    title: "Welcome to AIDE",
    bodyHtml: planBody({
      greeting: `Hi ${name},`,
      lines: [
        "Your account is ready. Finish onboarding, pick a plan, and deploy your first support agent.",
      ],
      ctaLabel: "Continue setup",
      ctaUrl: data.dashboardUrl,
    }),
  });
  return { subject, html, text };
}

export function renderVerifyEmail(data) {
  const name = data.name || "there";
  const subject = "Verify your email";
  const text = `Hi ${name},\n\nVerify your email: ${data.verifyUrl}\nThis link expires in ${data.expiresHours || 24} hours.\n`;
  const html = layout({
    title: "Verify your email",
    bodyHtml: planBody({
      greeting: `Hi ${name},`,
      lines: [
        `Confirm this address to finish setting up AIDE. The link expires in ${data.expiresHours || 24} hours.`,
      ],
      ctaLabel: "Verify email",
      ctaUrl: data.verifyUrl,
    }),
  });
  return { subject, html, text };
}

export function renderOnboardingDay1(data) {
  const name = data.name || "there";
  const subject = "Create your first support agent";
  const text = `Hi ${name},\n\nYour workspace is unlocked — create your first agent today.\n${data.dashboardUrl || ""}\n`;
  const html = layout({
    title: "Create your first agent",
    bodyHtml: planBody({
      greeting: `Hi ${name},`,
      lines: [
        "Your workspace is unlocked. Create an agent, add knowledge, and embed it on your site.",
      ],
      ctaLabel: "Open dashboard",
      ctaUrl: data.dashboardUrl,
    }),
  });
  return { subject, html, text };
}

export function renderLoginAlert(data) {
  const name = data.name || "there";
  const subject = "New sign-in to AIDE";
  const text = `Hi ${name},\n\nSomeone signed in to your AIDE account${data.when ? ` at ${data.when}` : ""}. If this was you, no action needed.\n`;
  const html = layout({
    title: "New sign-in",
    bodyHtml: planBody({
      greeting: `Hi ${name},`,
      lines: [
        `We noticed a sign-in to your AIDE account${data.when ? ` at ${data.when}` : ""}.`,
        "If this was you, you can ignore this email. If not, reset your password.",
      ],
      ctaLabel: "Reset password",
      ctaUrl: data.resetUrl,
    }),
  });
  return { subject, html, text };
}
