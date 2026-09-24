/**
 * Live loading-surface check against the already-running app (default :3000).
 * Registers a throwaway user, slows APIs, asserts preloader-over-skeleton, then clear.
 *
 * Run: node scripts/test-loading-surface-browser.mjs
 */
const { chromium, expect, request: playwrightRequest } = require("@playwright/test");
const { randomUUID } = require("node:crypto");

const BASE = process.env.TEST_BASE_URL || "http://127.0.0.1:3000";

async function json(response) {
  return response.json().catch(() => ({}));
}

async function registerAndUnlock(api) {
  const password = "LoadingSurf!2026";
  const email = `loading-surf-${Date.now()}-${randomUUID().slice(0, 6)}@aide.test`;

  const register = await api.post(`${BASE}/api/auth/register`, {
    data: { name: "Loading Surface", email, password, confirmPassword: password },
  });
  if (!(register.ok() || register.status() === 201)) {
    throw new Error(`register failed ${register.status()}`);
  }

  const csrfResponse = await api.get(`${BASE}/api/auth/csrf`);
  const csrf = await json(csrfResponse);
  if (!csrf.csrfToken) throw new Error("missing csrf");

  const login = await api.post(`${BASE}/api/auth/callback/credentials`, {
    form: { csrfToken: csrf.csrfToken, email, password, redirect: "false" },
    maxRedirects: 0,
  });
  if (![200, 302, 303].includes(login.status())) {
    throw new Error(`login failed ${login.status()}`);
  }

  const onboarding = await api.post(`${BASE}/api/onboarding`, {
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
  if (!onboarding.ok()) throw new Error(`onboarding failed ${onboarding.status()}`);

  const plans = await api.get(`${BASE}/api/billing/plans`);
  const plansBody = await json(plans);
  const freePlan = (plansBody.plans || []).find((plan) => plan.planType === "FREE");
  if (!freePlan?.id) throw new Error("no FREE plan");

  const subscribe = await api.post(`${BASE}/api/billing/subscribe`, {
    data: { planId: freePlan.id },
  });
  if (!subscribe.ok()) throw new Error(`subscribe failed ${subscribe.status()}`);

  const agentResponse = await api.post(`${BASE}/api/agents`, {
    data: {
      name: "Loading Surface Agent",
      welcomeMessage: "Ready",
      systemPrompt: "Be helpful.",
    },
  });
  if (agentResponse.status() !== 201) {
    throw new Error(`agent create failed ${agentResponse.status()}`);
  }
  const agent = await json(agentResponse);
  return { agentId: agent.id, storageState: await api.storageState() };
}

async function captureBusyOverlay(page) {
  return page.evaluate(() => {
    const busy = document.querySelector('[aria-busy="true"]');
    const status = document.querySelector('[role="status"]');
    const skeleton = document.querySelector('[data-slot="skeleton"]');
    return {
      busy: Boolean(busy),
      status: Boolean(status),
      skeleton: Boolean(skeleton),
      statusLabel: status?.getAttribute("aria-label") || "",
    };
  });
}

async function main() {
  const ready = await fetch(`${BASE}/readyz`).catch(() => null);
  if (!ready?.ok) {
    throw new Error(`App not ready at ${BASE}/readyz — start npm run dev first`);
  }

  const api = await playwrightRequest.newContext({ baseURL: BASE });
  const { agentId, storageState } = await registerAndUnlock(api);
  await api.dispose();

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ storageState, baseURL: BASE });
  const page = await context.newPage();

  const routes = [
    { path: "/dashboard", ready: /workspace|Agents|Conversations/i },
    { path: "/agents", ready: /Loading Surface Agent|No agents|New agent/i },
    { path: `/agents/${agentId}`, ready: /Loading Surface Agent|Overview|Knowledge/i },
    { path: `/agents/${agentId}/knowledge`, ready: /knowledge|FAQ|Upload|PDF/i },
    { path: `/agents/${agentId}/test`, ready: /Studio|Test|Type a test|visitor/i },
    { path: `/agents/${agentId}/edit`, ready: /Edit|Save|system prompt|Name/i },
    { path: "/inbox", ready: /inbox|Human|Waiting|Conversations|Desk/i },
    { path: "/analytics", ready: /Analytics|Conversations|Range|trend/i },
    { path: "/settings", ready: /Settings|Profile|Workspace|Account/i },
    { path: "/settings/billing", ready: /Billing|Plan|Usage|Subscribe/i },
    { path: "/conversations", ready: /Conversations|Chat|agent|Create/i },
  ];

  const report = [];

  for (const route of routes) {
    await page.route("**/api/**", async (r) => {
      await new Promise((resolve) => setTimeout(resolve, 400));
      await r.continue();
    });

    const navPromise = page.goto(route.path, { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(150);
    const mid = await captureBusyOverlay(page);
    await navPromise;
    await expect(page.locator("body")).toContainText(route.ready, {
      timeout: 45_000,
    });
    await page.waitForFunction(
      () => !document.querySelector('[aria-busy="true"]'),
      null,
      { timeout: 45_000 }
    );
    const after = await captureBusyOverlay(page);

    report.push({
      path: route.path,
      midBusy: mid.busy,
      midStatus: mid.status,
      midSkeleton: mid.skeleton,
      midLabel: mid.statusLabel,
      afterBusy: after.busy,
      afterStatus: after.status,
    });

    if (!(mid.status || mid.busy)) {
      throw new Error(`${route.path}: expected preloader/busy during load, got ${JSON.stringify(mid)}`);
    }
    if (after.busy) {
      throw new Error(`${route.path}: aria-busy still true after ready`);
    }

    await page.unroute("**/api/**");
  }

  const withBoth = report.filter((r) => r.midStatus && r.midSkeleton).length;
  if (withBoth < 4) {
    throw new Error(
      `Expected ≥4 routes with preloader+skeleton together, got ${withBoth}\n` +
        report.map((r) => JSON.stringify(r)).join("\n")
    );
  }

  console.log("PASS  loading-surface browser");
  for (const row of report) console.log(" ", JSON.stringify(row));

  await context.close();
  await browser.close();
}

main().catch((err) => {
  console.error("FAIL  loading-surface browser", err);
  process.exit(1);
});
