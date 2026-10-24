/**
 * Minimal Playwright full user-flow smoke (Phase 14).
 * Complements embed-full / confirmation-ui / product API suites.
 */
const { test, expect } = require("@playwright/test");
const { randomUUID } = require("node:crypto");

async function json(response) {
  return response.json().catch(() => ({}));
}

async function registerOwner(request) {
  const password = "FullFlow!2026";
  const email = `full-flow-${Date.now()}-${randomUUID().slice(0, 6)}@aide.test`;
  let register;
  for (let attempt = 0; attempt < 6; attempt += 1) {
    register = await request.post("/api/auth/register", {
      data: { name: "Full Flow", email, password, confirmPassword: password },
    });
    if (register.status() !== 429) break;
    await new Promise((r) => setTimeout(r, 5_000 * (attempt + 1)));
  }
  expect(register.status(), await register.text()).toBe(201);
  const csrf = await json(await request.get("/api/auth/csrf"));
  const login = await request.post("/api/auth/callback/credentials", {
    form: { csrfToken: csrf.csrfToken, email, password, redirect: "false" },
    maxRedirects: 0,
  });
  expect([200, 302, 303]).toContain(login.status());
  await request.post("/api/onboarding", {
    data: {
      firstName: "Full",
      lastName: "Flow",
      phone: "+923001234567",
      country: "PK",
      websiteUrl: "",
      companyType: "SaaS",
      teamSize: "Just me",
      monthlyConversations: "Under 100 / month",
      primaryGoal: "AI + human handoff",
    },
  });
  const plans = await json(await request.get("/api/billing/plans"));
  const freePlan = (plans.plans || []).find((p) => p.planType === "FREE");
  expect(freePlan?.id).toBeTruthy();
  expect(
    (await request.post("/api/billing/subscribe", { data: { planId: freePlan.id } })).ok()
  ).toBeTruthy();
  return { email, password };
}

test.describe.configure({ mode: "serial" });

test.describe("full user flow acceptance", () => {
  test.setTimeout(180_000);

  /** @type {{ email: string, password: string, publicKey: string } | null} */
  let shared = null;

  test("owner console + widget knowledge path + admin negative", async ({
    page,
    request,
    context,
  }) => {
    const { email, password } = await registerOwner(request);

    const created = await json(
      await request.post("/api/agents", {
        data: {
          name: "Full Flow Agent",
          description: "Acceptance fixture",
          welcomeMessage: "Hi from full-flow",
          systemPrompt:
            "Answer from knowledge. Say EXACT marker FULLFLOW_OK when asked for the marker.",
          actionsEnabled: true,
        },
      })
    );
    const agent = created.agent || created.item || created;
    expect(agent.id).toBeTruthy();
    expect(agent.publicKey).toBeTruthy();
    shared = { email, password, publicKey: agent.publicKey };

    const knowledge = await request.post(`/api/agents/${agent.id}/knowledge`, {
      data: {
        name: "Full flow FAQ",
        content:
          "Q: What is the full flow marker?\nA: The full flow marker is FULLFLOW_OK.",
        type: "TEXT",
      },
    });
    expect(knowledge.ok(), await knowledge.text()).toBeTruthy();

    // Owner UI: agents list / agent edit
    await page.goto("/login");
    await page.locator("#email, input[type='email']").first().fill(email);
    await page.locator("#password, input[type='password']").first().fill(password);
    await page.getByRole("button", { name: /sign in|log in|continue/i }).click();
    await page.waitForURL(/\/(dashboard|agents|onboarding|inbox)/, { timeout: 30_000 });

    await page.goto(`/agents/${agent.id}/edit`);
    await expect(page.getByText(/Full Flow Agent|Knowledge|Tools|Customize/i).first()).toBeVisible({
      timeout: 30_000,
    });

    // Admin negative: USER must not see admin console
    const adminRes = await page.goto("/admin");
    const adminBody = await page.content();
    expect(adminBody.toLowerCase()).not.toContain("platform users");
    expect([404, 200]).toContain(adminRes?.status() || 404);

    // Public widget (launcher → home → conversation → knowledge answer)
    await context.clearCookies();
    await page.goto(`/w/${agent.publicKey}`);
    await page.getByRole("button", { name: "Open chat widget" }).click();
    await page.getByRole("button", { name: /Send us a message/i }).click();
    const composer = page.getByRole("textbox", { name: /message/i });
    await expect(composer).toBeVisible({ timeout: 60_000 });

    await composer.fill("What is the full flow marker?");
    await page.getByRole("button", { name: "Send message" }).click();
    await expect(page.getByText(/FULLFLOW_OK/i).first()).toBeVisible({
      timeout: 90_000,
    });
  });

  test("mobile widget viewport does not horizontal-break", async ({ page }) => {
    expect(shared?.publicKey).toBeTruthy();
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(`/w/${shared.publicKey}`);
    await page.waitForTimeout(500);
    const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth);
    const clientWidth = await page.evaluate(() => document.documentElement.clientWidth);
    expect(scrollWidth).toBeLessThanOrEqual(clientWidth + 2);
  });
});
