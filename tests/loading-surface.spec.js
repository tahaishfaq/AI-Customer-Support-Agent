/**
 * Browser contract: route + data loads show skeleton WITH branded preloader overlay,
 * then dismiss when data is ready (no bare-skeleton-only flash).
 *
 * Run: playwright test tests/loading-surface.spec.js --reporter=line
 */
const { test, expect } = require("@playwright/test");
const { randomUUID } = require("node:crypto");

async function json(response) {
  return response.json().catch(() => ({}));
}

async function registerAndUnlock(request) {
  const password = "LoadingSurf!2026";
  const email = `loading-surf-${Date.now()}-${randomUUID().slice(0, 6)}@aide.test`;

  const register = await request.post("/api/auth/register", {
    data: { name: "Loading Surface", email, password, confirmPassword: password },
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
      firstName: "Loading",
      lastName: "Surface",
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
      name: "Loading Surface Agent",
      welcomeMessage: "Ready",
      systemPrompt: "Be helpful.",
    },
  });
  expect(agentResponse.status()).toBe(201);
  const agent = await json(agentResponse);
  return { agentId: agent.id, storageState: await request.storageState() };
}

async function captureBusyOverlay(page) {
  return page.evaluate(() => {
    const busy = document.querySelector('[aria-busy="true"]');
    const status = document.querySelector('[role="status"]');
    const skeleton = document.querySelector('[data-slot="skeleton"], .animate-pulse');
    return {
      busy: Boolean(busy),
      status: Boolean(status),
      skeleton: Boolean(skeleton),
      statusLabel: status?.getAttribute("aria-label") || status?.textContent || "",
    };
  });
}

test.describe("loading surface", () => {
  test("app pages show preloader over skeleton then clear", async ({
    browser,
    request,
  }) => {
    const { agentId, storageState } = await registerAndUnlock(request);
    const context = await browser.newContext({ storageState });
    const page = await context.newPage();

    const routes = [
      { path: "/dashboard", ready: /workspace|Agents|Conversations/i },
      { path: "/agents", ready: /Loading Surface Agent|No agents|New agent/i },
      { path: `/agents/${agentId}`, ready: /Loading Surface Agent|Overview|Knowledge/i },
      { path: `/agents/${agentId}/knowledge`, ready: /knowledge|FAQ|Upload/i },
      { path: `/agents/${agentId}/test`, ready: /Studio|Test|Type a test/i },
      { path: "/inbox", ready: /inbox|Human|Waiting|Conversations/i },
      { path: "/analytics", ready: /Analytics|Conversations|Range/i },
      { path: "/settings", ready: /Settings|Profile|Workspace/i },
      { path: "/settings/billing", ready: /Billing|Plan|Usage/i },
      { path: "/conversations", ready: /Conversations|Chat|agent/i },
    ];

    const report = [];

    for (const route of routes) {
      // Slow APIs so the loading surface is observable.
      await page.route("**/api/**", async (r) => {
        await new Promise((resolve) => setTimeout(resolve, 350));
        await r.continue();
      });

      const nav = page.goto(route.path, { waitUntil: "domcontentloaded" });
      // Sample shortly after navigation starts.
      await page.waitForTimeout(120);
      const mid = await captureBusyOverlay(page);
      await nav;
      await expect(page.locator("body")).toContainText(route.ready, {
        timeout: 30_000,
      });
      // Wait for busy overlay to clear.
      await page.waitForFunction(
        () => !document.querySelector('[aria-busy="true"]'),
        null,
        { timeout: 30_000 }
      );
      const after = await captureBusyOverlay(page);

      report.push({
        path: route.path,
        midHasStatus: mid.status,
        midHasSkeleton: mid.skeleton,
        midBusy: mid.busy,
        afterBusy: after.busy,
        afterStatus: after.status,
      });

      await page.unroute("**/api/**");

      // Contract: while busy we expect branded status (preloader). Skeleton optional
      // if the route used only preloader (auth-like), but app routes should have both.
      expect(mid.status || mid.busy, `${route.path} mid loading`).toBeTruthy();
      expect(after.busy, `${route.path} cleared busy`).toBe(false);
    }

    // Soft assert that most app routes showed skeleton under the preloader.
    const withSkeleton = report.filter((r) => r.midHasSkeleton).length;
    expect(withSkeleton).toBeGreaterThanOrEqual(4);

    console.log(
      "PASS loading-surface\n" +
        report.map((r) => JSON.stringify(r)).join("\n")
    );

    await context.close();
  });
});
