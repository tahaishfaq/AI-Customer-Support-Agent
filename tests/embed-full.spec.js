const { test, expect } = require("@playwright/test");
const { randomUUID } = require("node:crypto");

async function json(response) {
  return response.json().catch(() => ({}));
}

async function createEmbedFixture(request) {
  const password = "EmbedE2E!2026";
  const email = `embed-full-${Date.now()}-${randomUUID().slice(0, 6)}@aide.test`;

  const register = await request.post("/api/auth/register", {
    data: { name: "Embed Full E2E", email, password, confirmPassword: password },
  });
  expect(register.status()).toBe(201);

  const csrf = await json(await request.get("/api/auth/csrf"));
  const login = await request.post("/api/auth/callback/credentials", {
    form: { csrfToken: csrf.csrfToken, email, password, redirect: "false" },
    maxRedirects: 0,
  });
  expect([200, 302, 303]).toContain(login.status());

  const onboarding = await request.post("/api/onboarding", {
    data: {
      firstName: "Embed",
      lastName: "E2E",
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

  const plans = await json(await request.get("/api/billing/plans"));
  const freePlan = (plans.plans || []).find((plan) => plan.planType === "FREE");
  expect(freePlan?.id).toBeTruthy();
  expect((await request.post("/api/billing/subscribe", { data: { planId: freePlan.id } })).ok()).toBeTruthy();

  const createdResponse = await request.post("/api/agents", {
    data: {
      name: "AIDE Embedded Full E2E",
      description: "Disposable local embed acceptance fixture",
      welcomeMessage: "Welcome to the embedded AIDE test agent.",
      systemPrompt: "Answer from the configured knowledge. Repeat exact FAQ or retrieval markers when the visitor asks for them. Use human handoff when the visitor requests a person.",
      actionsEnabled: true,
      webSearchEnabled: true,
    },
  });
  const created = await json(createdResponse);
  const agent = created.agent || created.item || created;
  expect(createdResponse.status(), JSON.stringify(created)).toBe(201);
  expect(agent.id, JSON.stringify(created)).toBeTruthy();
  expect(agent.publicKey, JSON.stringify(created)).toBeTruthy();
  expect(agent.webSearchEnabled, JSON.stringify(created)).toBe(true);

  const faq = await request.post(`/api/agents/${agent.id}/knowledge`, {
    data: {
      name: "Embed FAQ",
      type: "TEXT",
      content: "AIDE supports knowledge-grounded customer support, human handoff, and secure website embedding. FAQ marker: EMBED-FAQ-5182.",
    },
  });
  expect(faq.ok()).toBeTruthy();

  const long = await request.post(`/api/agents/${agent.id}/knowledge`, {
    data: {
      name: "Embed Long Guide",
      type: "TEXT",
      content: Array.from({ length: 18 }, (_, index) => `Section ${index + 1}: AIDE keeps tenant data isolated, streams answers, supports human handoff, and uses Redis-backed realtime delivery.`).join("\n") + "\nFar-end retrieval marker: EMBED-LONG-9347.",
    },
  });
  expect(long.ok()).toBeTruthy();

  const action = await request.post(`/api/agents/${agent.id}/actions`, {
    data: {
      name: "get_embed_test_json",
      description: "Read the approved embed test JSON endpoint",
      method: "GET",
      urlTemplate: "https://httpbin.org/json",
      accessClass: "PUBLIC_READ",
      enabled: true,
      outputSchemaJson: {},
    },
  });
  expect(action.ok()).toBeTruthy();

  return { agent, email };
}

test("actual local embed runs guest, RAG, logged-in, handoff, stream, and realtime checks", async ({
  page,
  request,
}) => {
  test.setTimeout(120_000);
  const realtimeResponses = [];
  const realtimeSockets = [];
  const realtimeHandshakeOrigins = [];
  const embedDiagnostics = [];
  const cdp = await page.context().newCDPSession(page);
  await cdp.send("Network.enable");
  await page.addInitScript(() => {
    window.__aideEmbedMessages = [];
    window.addEventListener("message", (event) => {
      if (event.data?.source === "hapy-widget") {
        window.__aideEmbedMessages.push({ type: event.data.type, origin: event.origin });
      }
    });
  });
  cdp.on("Network.webSocketWillSendHandshakeRequest", (event) => {
    const url = event.request?.url || event.url || "";
    if (url.includes("socket.io")) {
      realtimeHandshakeOrigins.push(event.request.headers.Origin || event.request.headers.origin || null);
    }
  });
  page.on("websocket", (socket) => {
    if (!socket.url().includes("socket.io")) return;
    const item = { url: socket.url(), closed: false };
    realtimeSockets.push(item);
    socket.on("close", () => {
      item.closed = true;
    });
  });
  page.on("response", async (response) => {
    if (
      response.url().includes("/embed.js") ||
      response.url().includes("/w/") ||
      response.url().includes("/api/public/agents/")
    ) {
      embedDiagnostics.push({
        url: response.url().replace(/\/w\/[^/?]+/, "/w/:publicKey").replace(/\/api\/public\/agents\/[^/]+/, "/api/public/agents/:publicKey"),
        status: response.status(),
      });
    }
    if (!response.url().includes("/realtime-token")) return;
    const body = await response.json().catch(() => ({}));
    realtimeResponses.push({
      status: response.status(),
      hasToken: Boolean(body.token),
      realtimeUrl: body.realtimeUrl || null,
    });
  });
  page.on("response", async (response) => {
    if (!response.url().endsWith("/chat")) return;
    const contentType = response.headers()["content-type"] || "";
    const body = await response.text().catch(() => "");
    const events = [...body.matchAll(/event:\s*([^\n]+)/g)].map((match) => match[1].trim());
    const codes = [...body.matchAll(/"code":"([A-Z0-9_-]+)"/g)].map((match) => match[1]);
    embedDiagnostics.push({ type: "chat-response", status: response.status(), contentType, events, codes });
  });
  page.on("requestfailed", (requestEvent) => {
    if (requestEvent.url().includes("/w/") || requestEvent.url().includes("/api/public/agents/")) {
      embedDiagnostics.push({
        type: "requestfailed",
        url: requestEvent.url().replace(/\/w\/[^/?]+/, "/w/:publicKey").replace(/\/api\/public\/agents\/[^/]+/, "/api/public/agents/:publicKey"),
        failure: requestEvent.failure()?.errorText || "unknown",
      });
    }
  });
  page.on("frameattached", (childFrame) => {
    if (childFrame !== page.mainFrame()) embedDiagnostics.push({ type: "frameattached", url: childFrame.url() });
  });
  page.on("framenavigated", (childFrame) => {
    if (childFrame !== page.mainFrame() && (childFrame.url().includes("/w/") || childFrame.url())) {
      embedDiagnostics.push({ type: "framenavigated", url: childFrame.url().replace(/\/w\/[^/?]+/, "/w/:publicKey") });
    }
  });
  page.on("pageerror", (error) => embedDiagnostics.push({ type: "pageerror", message: error.message }));
  const { agent } = await createEmbedFixture(request);
  const initialWidgetProbe = await request.get(`/w/${agent.publicKey}?parentOrigin=${encodeURIComponent("http://127.0.0.1:4333")}&embed=float`, {
    headers: {
      Origin: "http://127.0.0.1:4333",
      Referer: "http://127.0.0.1:4333/",
    },
  });
  embedDiagnostics.push({ type: "initial-widget-probe", status: initialWidgetProbe.status() });
  const frameSelector = `iframe[data-hapy-widget="${agent.publicKey}"]`;
  const frame = () => page.frameLocator(frameSelector);

  // Use a static host page so the app shell's GlobalEmbedLoader cannot race
  // this disposable fixture and replace its iframe.
  await page.goto("/demo-slides.html");
  await page.evaluate((publicKey) => new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = "/embed.js?v=11";
    script.dataset.aideKey = publicKey;
    script.onload = resolve;
    script.onerror = () => reject(new Error("embed.js failed to load"));
    document.body.appendChild(script);
  }).then(() => window.aideChat?.init({ publicKey })), agent.publicKey);

  const iframe = page.locator(frameSelector);
  const embedRuntime = await page.evaluate(() => ({
    hasAideChat: Boolean(window.aideChat),
    readyState: document.readyState,
    frameCount: document.querySelectorAll("iframe[data-hapy-widget]").length,
  }));
  await expect(iframe, JSON.stringify({ embedDiagnostics, embedRuntime, realtimeResponses, messages: await page.evaluate(() => window.__aideEmbedMessages || []) })).toBeVisible({ timeout: 15_000 });
  await expect(frame().getByRole("button", { name: "Open chat widget" })).toBeVisible();
  await frame().getByRole("button", { name: "Open chat widget" }).click();
  await expect(frame().getByText("AIDE Embedded Full E2E").first()).toBeVisible();
  await frame().getByRole("button", { name: "Start conversation" }).click();

  const input = frame().locator('textarea[placeholder="Type your message..."]');
  await expect(input).toBeVisible();

  await input.fill("What does AIDE support? Include the FAQ marker.");
  await input.press("Enter");
  await expect(frame().getByText(/EMBED-FAQ-5182/)).toBeVisible({ timeout: 30_000 });

  await input.fill("Explain the long guide and include the far-end marker.");
  await input.press("Enter");
  await expect(frame().getByText(/EMBED-LONG-9347/)).toBeVisible({ timeout: 30_000 });

  if (process.env.OPENAI_WEB_SEARCH_ENABLED === "true") {
    await input.fill("Search online for the current OpenAI API documentation homepage and cite your sources.");
    await input.press("Enter");
    await expect(frame().getByTestId("agent-activity")).toBeVisible({ timeout: 10_000 });
    await expect(frame().getByText(/OpenAI API documentation/i)).toBeVisible({ timeout: 30_000 });
    const webSources = frame().locator('[aria-label="Web sources"]');
    await expect(webSources, JSON.stringify({
      links: await frame().locator('a[href^="https://"]').evaluateAll((items) => items.map((item) => ({ href: item.href, text: item.textContent }))),
      body: await frame().locator("body").innerText(),
    })).toBeVisible({ timeout: 10_000 });
  }

  await input.fill("I am very happy with this support.");
  await input.press("Enter");
  await expect(frame().getByText("I am very happy with this support.")).toBeVisible();

  const realtimeMetrics = await page.evaluate(() =>
    fetch("/metrics").then((response) => response.json()).catch(() => null)
  );
  await expect(
    frame().locator('[data-realtime-status="connected"]'),
    JSON.stringify({ realtimeResponses, realtimeSockets, realtimeHandshakeOrigins, realtimeMetrics })
  ).toBeVisible({ timeout: 15_000 });

  const conversationId = await frame().locator("[data-realtime-conversation]").getAttribute("data-realtime-conversation");
  const publicAccessToken = await frame().locator("body").evaluate(
    (_, { publicKey, conversationId }) =>
      localStorage.getItem(`aide:realtime-access:${publicKey}:${conversationId}`),
    { publicKey: agent.publicKey, conversationId }
  );
  const handoffResponse = await request.post(
    `/api/public/agents/${agent.publicKey}/conversations/${conversationId}/handoff`,
    {
      headers: {
        Origin: "http://127.0.0.1:4333",
        Referer: "http://127.0.0.1:4333/",
        "x-aide-conversation-access-token": publicAccessToken || "",
      },
      data: { reason: "Customer requested human support" },
    }
  );
  const handoffResult = {
    status: handoffResponse.status(),
    body: await handoffResponse.json().catch(() => ({})),
  };
  expect(handoffResult.status, JSON.stringify(handoffResult.body)).toBe(200);
  await expect(frame().getByText(/waiting|human support|connected/i).first()).toBeVisible({ timeout: 15_000 });

  const loggedInPage = await page.context().newPage();
  const loggedDiagnostics = [];
  loggedInPage.on("response", (response) => {
    if (response.url().includes("/embed.js") || response.url().includes("/w/") || response.url().includes("/api/public/agents/")) {
      loggedDiagnostics.push({ url: response.url().replace(/\/w\/[^/?]+/, "/w/:publicKey").replace(/\/api\/public\/agents\/[^/]+/, "/api/public/agents/:publicKey"), status: response.status() });
    }
  });
  loggedInPage.on("requestfailed", (requestEvent) => {
    if (requestEvent.url().includes("/w/") || requestEvent.url().includes("/api/public/agents/")) {
      loggedDiagnostics.push({ type: "requestfailed", url: requestEvent.url().replace(/\/w\/[^/?]+/, "/w/:publicKey"), failure: requestEvent.failure()?.errorText || "unknown" });
    }
  });
  loggedInPage.on("pageerror", (error) => loggedDiagnostics.push({ type: "pageerror", message: error.message }));
  const widgetProbe = await request.get(`/w/${agent.publicKey}?parentOrigin=${encodeURIComponent("http://127.0.0.1:4333")}&embed=float`, {
    headers: {
      Origin: "http://127.0.0.1:4333",
      Referer: "http://127.0.0.1:4333/",
    },
  });
  loggedDiagnostics.push({ type: "widget-probe", status: widgetProbe.status() });
  await loggedInPage.goto("/demo-slides.html");
  await loggedInPage.evaluate((publicKey) => new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = "/embed.js?v=11";
    script.dataset.aideKey = publicKey;
    script.onload = resolve;
    script.onerror = () => reject(new Error("embed.js failed to load"));
    document.body.appendChild(script);
  }).then(() => window.aideChat?.init({ publicKey })), agent.publicKey);
  const loggedFrameSelector = `iframe[data-hapy-widget="${agent.publicKey}"]`;
  const loggedFrame = () => loggedInPage.frameLocator(loggedFrameSelector);
  await expect(loggedInPage.locator(loggedFrameSelector), JSON.stringify({ loggedDiagnostics, runtime: await loggedInPage.evaluate(() => ({ hasAideChat: Boolean(window.aideChat), frames: document.querySelectorAll("iframe[data-hapy-widget]").length })) })).toBeVisible({ timeout: 15_000 });
  await loggedInPage.evaluate(() => {
    window.aideChat?.setUser({
      subject: "embed-local-user-1",
      displayName: "Embed Local User",
    });
  });
  await loggedFrame().getByRole("button", { name: "Open chat widget" }).click();
  const loggedStart = loggedFrame().getByRole("button", { name: "Start conversation" });
  if (await loggedStart.isVisible({ timeout: 3_000 }).catch(() => false)) {
    await loggedStart.click();
  }
  const loggedInput = loggedFrame().locator('textarea[placeholder="Type your message..."]');
  await expect(loggedInput).toBeVisible();
  await loggedInput.fill("I am logged in on the customer website. What support features are available?");
  await loggedInput.press("Enter");
  await expect(loggedFrame().getByText(/I am logged in on the customer website/)).toBeVisible();
  await expect(loggedFrame().locator('[data-realtime-status="connected"]')).toBeVisible({ timeout: 15_000 });
  await loggedInPage.close();

});
