const { test, expect } = require("@playwright/test");
const { randomUUID } = require("node:crypto");

async function json(response) {
  return response.json().catch(() => ({}));
}

async function registerAndUnlock(request) {
  const password = "ConfirmUI!2026";
  const email = `confirm-ui-${Date.now()}-${randomUUID().slice(0, 6)}@aide.test`;

  const register = await request.post("/api/auth/register", {
    data: { name: "Confirmation UI", email, password, confirmPassword: password },
  });
  expect(register.ok() || register.status() === 201).toBeTruthy();

  const csrfResponse = await request.get("/api/auth/csrf");
  const csrf = await json(csrfResponse);
  expect(csrf.csrfToken).toBeTruthy();

  const login = await request.post("/api/auth/callback/credentials", {
    form: { csrfToken: csrf.csrfToken, email, password, redirect: "false" },
    maxRedirects: 0,
  });
  expect([200, 302, 303].includes(login.status())).toBeTruthy();

  const onboarding = await request.post("/api/onboarding", {
    data: {
      firstName: "Confirmation",
      lastName: "UI",
      phone: "+923001234567",
      country: "PK",
      websiteUrl: "",
      companyType: "SaaS",
      teamSize: "Just me",
      monthlyConversations: "Under 100 / month",
      primaryGoal: "AI + human handoff",
    },
  });
  expect(onboarding.ok()).toBeTruthy();

  const plans = await request.get("/api/billing/plans");
  const plansBody = await json(plans);
  const freePlan = (plansBody.plans || []).find((plan) => plan.planType === "FREE");
  expect(freePlan?.id).toBeTruthy();

  const subscribe = await request.post("/api/billing/subscribe", {
    data: { planId: freePlan.id },
  });
  expect(subscribe.ok()).toBeTruthy();

  const agentResponse = await request.post("/api/agents", {
    data: {
      name: "Confirmation UI Agent",
      welcomeMessage: "Ready",
      systemPrompt: "Use confirmation before write actions.",
    },
  });
  expect(agentResponse.status()).toBe(201);
  const agent = await json(agentResponse);
  return { agentId: agent.id, storageState: await request.storageState() };
}

test("studio confirmation UI approves once and resumes the action", async ({
  browser,
  request,
}) => {
  const { agentId, storageState } = await registerAndUnlock(request);
  const context = await browser.newContext({ storageState });
  const page = await context.newPage();
  let chatCalls = 0;
  let confirmationCalls = 0;

  await page.route(`**/api/agents/${agentId}/chat`, async (route) => {
    chatCalls += 1;
    const body = chatCalls === 1
      ? {
          conversationId: "confirm-ui-conversation",
          userMessage: {
            id: "confirm-ui-user-message",
            role: "USER",
            content: "Cancel my subscription",
            createdAt: new Date().toISOString(),
          },
          message: {
            id: "confirm-ui-assistant-message",
            role: "ASSISTANT",
            content: "I can cancel it after your confirmation.",
            responseTime: 12,
            createdAt: new Date().toISOString(),
          },
          pendingConfirmations: [
            {
              id: "confirm-ui-pending",
              status: "PENDING",
              actionName: "cancel_subscription",
              actionDescription: "cancel your subscription",
              args: { reason: "user requested" },
            },
          ],
        }
      : {
          conversationId: "confirm-ui-conversation",
          userMessage: {
            id: "confirm-ui-resume-user-message",
            role: "USER",
            content: "Approved",
            createdAt: new Date().toISOString(),
          },
          message: {
            id: "confirm-ui-resumed-message",
            role: "ASSISTANT",
            content: "The action was completed once.",
            responseTime: 12,
            createdAt: new Date().toISOString(),
          },
          pendingConfirmations: [],
        };
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(body),
    });
  });

  await page.route("**/api/conversations/*/confirmations/*", async (route) => {
    confirmationCalls += 1;
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        id: "confirm-ui-pending",
        status: "APPROVED",
        lifecyclePhase: "CONFIRMED",
      }),
    });
  });

  try {
    await page.goto(`/agents/${agentId}/test`);
    const input = page.locator("textarea[placeholder*='test message'], textarea[placeholder*='visitor']").first();
    await expect(input).toBeVisible();
    await input.fill("Cancel my subscription");
    await input.press("Enter");

    await expect(page.getByText("Confirm: cancel your subscription")).toBeVisible();
    const confirmButton = page.getByRole("button", { name: "Confirm", exact: true });
    await expect(confirmButton).toBeEnabled();
    await confirmButton.click();

    await expect(page.getByText("Confirmed ✓")).toBeVisible();
    await expect(page.getByText("The action was completed once.")).toBeVisible();
    expect(confirmationCalls).toBe(1);
    expect(chatCalls).toBe(2);
  } finally {
    await context.close();
  }
});
