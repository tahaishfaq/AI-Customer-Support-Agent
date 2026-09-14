# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: embed-full.spec.js >> actual local embed runs guest, RAG, logged-in, handoff, stream, and realtime checks
- Location: tests/embed-full.spec.js:94:1

# Error details

```
Error: expect(received).toBeTruthy()

Received: false
```

# Test source

```ts
  1   | const { test, expect } = require("@playwright/test");
  2   | const { randomUUID } = require("node:crypto");
  3   | 
  4   | async function json(response) {
  5   |   return response.json().catch(() => ({}));
  6   | }
  7   | 
  8   | async function createEmbedFixture(request) {
  9   |   const password = "EmbedE2E!2026";
  10  |   const email = `embed-full-${Date.now()}-${randomUUID().slice(0, 6)}@aide.test`;
  11  | 
  12  |   const register = await request.post("/api/auth/register", {
  13  |     data: { name: "Embed Full E2E", email, password, confirmPassword: password },
  14  |   });
  15  |   expect(register.status()).toBe(201);
  16  | 
  17  |   const csrf = await json(await request.get("/api/auth/csrf"));
  18  |   const login = await request.post("/api/auth/callback/credentials", {
  19  |     form: { csrfToken: csrf.csrfToken, email, password, redirect: "false" },
  20  |     maxRedirects: 0,
  21  |   });
  22  |   expect([200, 302, 303]).toContain(login.status());
  23  | 
  24  |   const onboarding = await request.post("/api/onboarding", {
  25  |     data: {
  26  |       firstName: "Embed",
  27  |       lastName: "E2E",
  28  |       phone: "+923001234567",
  29  |       country: "PK",
  30  |       websiteUrl: "",
  31  |       companyType: "SaaS",
  32  |       teamSize: "Just me",
  33  |       monthlyConversations: "Under 100 / month",
  34  |       primaryGoal: "AI + human handoff",
  35  |     },
  36  |   });
  37  |   expect(onboarding.ok()).toBeTruthy();
  38  | 
  39  |   const plans = await json(await request.get("/api/billing/plans"));
  40  |   const freePlan = (plans.plans || []).find((plan) => plan.planType === "FREE");
  41  |   expect(freePlan?.id).toBeTruthy();
  42  |   expect((await request.post("/api/billing/subscribe", { data: { planId: freePlan.id } })).ok()).toBeTruthy();
  43  | 
  44  |   const createdResponse = await request.post("/api/agents", {
  45  |     data: {
  46  |       name: "AIDE Embedded Full E2E",
  47  |       description: "Disposable local embed acceptance fixture",
  48  |       welcomeMessage: "Welcome to the embedded AIDE test agent.",
  49  |       systemPrompt: "Answer from the configured knowledge. Repeat exact FAQ or retrieval markers when the visitor asks for them. Use human handoff when the visitor requests a person.",
  50  |       actionsEnabled: true,
  51  |       webSearchEnabled: true,
  52  |     },
  53  |   });
  54  |   const created = await json(createdResponse);
  55  |   const agent = created.agent || created.item || created;
  56  |   expect(createdResponse.status(), JSON.stringify(created)).toBe(201);
  57  |   expect(agent.id, JSON.stringify(created)).toBeTruthy();
  58  |   expect(agent.publicKey, JSON.stringify(created)).toBeTruthy();
  59  | 
  60  |   const faq = await request.post(`/api/agents/${agent.id}/knowledge`, {
  61  |     data: {
  62  |       name: "Embed FAQ",
  63  |       type: "TEXT",
  64  |       content: "AIDE supports knowledge-grounded customer support, human handoff, and secure website embedding. FAQ marker: EMBED-FAQ-5182.",
  65  |     },
  66  |   });
  67  |   expect(faq.ok()).toBeTruthy();
  68  | 
  69  |   const long = await request.post(`/api/agents/${agent.id}/knowledge`, {
  70  |     data: {
  71  |       name: "Embed Long Guide",
  72  |       type: "TEXT",
  73  |       content: Array.from({ length: 18 }, (_, index) => `Section ${index + 1}: AIDE keeps tenant data isolated, streams answers, supports human handoff, and uses Redis-backed realtime delivery.`).join("\n") + "\nFar-end retrieval marker: EMBED-LONG-9347.",
  74  |     },
  75  |   });
  76  |   expect(long.ok()).toBeTruthy();
  77  | 
  78  |   const action = await request.post(`/api/agents/${agent.id}/actions`, {
  79  |     data: {
  80  |       name: "get_embed_test_json",
  81  |       description: "Read the approved embed test JSON endpoint",
  82  |       method: "GET",
  83  |       urlTemplate: "https://httpbin.org/json",
  84  |       accessClass: "PUBLIC_READ",
  85  |       enabled: true,
  86  |       outputSchemaJson: {},
  87  |     },
  88  |   });
> 89  |   expect(action.ok()).toBeTruthy();
      |                       ^ Error: expect(received).toBeTruthy()
  90  | 
  91  |   return { agent, email };
  92  | }
  93  | 
  94  | test("actual local embed runs guest, RAG, logged-in, handoff, stream, and realtime checks", async ({
  95  |   page,
  96  |   request,
  97  | }) => {
  98  |   test.setTimeout(120_000);
  99  |   const realtimeResponses = [];
  100 |   const realtimeSockets = [];
  101 |   const realtimeHandshakeOrigins = [];
  102 |   const cdp = await page.context().newCDPSession(page);
  103 |   await cdp.send("Network.enable");
  104 |   cdp.on("Network.webSocketWillSendHandshakeRequest", (event) => {
  105 |     const url = event.request?.url || event.url || "";
  106 |     if (url.includes("socket.io")) {
  107 |       realtimeHandshakeOrigins.push(event.request.headers.Origin || event.request.headers.origin || null);
  108 |     }
  109 |   });
  110 |   page.on("websocket", (socket) => {
  111 |     if (!socket.url().includes("socket.io")) return;
  112 |     const item = { url: socket.url(), closed: false };
  113 |     realtimeSockets.push(item);
  114 |     socket.on("close", () => {
  115 |       item.closed = true;
  116 |     });
  117 |   });
  118 |   page.on("response", async (response) => {
  119 |     if (!response.url().includes("/realtime-token")) return;
  120 |     const body = await response.json().catch(() => ({}));
  121 |     realtimeResponses.push({
  122 |       status: response.status(),
  123 |       hasToken: Boolean(body.token),
  124 |       realtimeUrl: body.realtimeUrl || null,
  125 |     });
  126 |   });
  127 |   const { agent } = await createEmbedFixture(request);
  128 |   const frameSelector = `iframe[data-hapy-widget="${agent.publicKey}"]`;
  129 |   const frame = () => page.frameLocator(frameSelector);
  130 | 
  131 |   await page.goto("/");
  132 |   await page.evaluate((publicKey) => {
  133 |     const script = document.createElement("script");
  134 |     script.src = "/embed.js?v=11";
  135 |     script.dataset.aideKey = publicKey;
  136 |     document.body.appendChild(script);
  137 |   }, agent.publicKey);
  138 | 
  139 |   const iframe = page.locator(frameSelector);
  140 |   await expect(iframe).toBeVisible({ timeout: 15_000 });
  141 |   await expect(frame().getByRole("button", { name: "Open chat widget" })).toBeVisible();
  142 |   await frame().getByRole("button", { name: "Open chat widget" }).click();
  143 |   await expect(frame().getByText("AIDE Embedded Full E2E").first()).toBeVisible();
  144 | 
  145 |   const input = frame().locator('textarea[placeholder="Type your message..."]');
  146 |   await expect(input).toBeVisible();
  147 | 
  148 |   await input.fill("What does AIDE support? Include the FAQ marker.");
  149 |   await input.press("Enter");
  150 |   await expect(frame().getByText(/EMBED-FAQ-5182/)).toBeVisible({ timeout: 30_000 });
  151 | 
  152 |   await input.fill("Explain the long guide and include the far-end marker.");
  153 |   await input.press("Enter");
  154 |   await expect(frame().getByText(/EMBED-LONG-9347/)).toBeVisible({ timeout: 30_000 });
  155 | 
  156 |   await input.fill("I am very happy with this support.");
  157 |   await input.press("Enter");
  158 |   await expect(frame().getByText("I am very happy with this support.")).toBeVisible();
  159 | 
  160 |   const realtimeMetrics = await page.evaluate(() =>
  161 |     fetch("/metrics").then((response) => response.json()).catch(() => null)
  162 |   );
  163 |   await expect(
  164 |     frame().locator('[data-realtime-status="connected"]'),
  165 |     JSON.stringify({ realtimeResponses, realtimeSockets, realtimeHandshakeOrigins, realtimeMetrics })
  166 |   ).toBeVisible({ timeout: 15_000 });
  167 | 
  168 |   const conversationId = await frame().locator("[data-realtime-conversation]").getAttribute("data-realtime-conversation");
  169 |   const handoffResult = await page.evaluate(async ({ publicKey, conversationId }) => {
  170 |     const token = localStorage.getItem(`aide:realtime-access:${publicKey}:${conversationId}`);
  171 |     const response = await fetch(`/api/public/agents/${publicKey}/conversations/${conversationId}/handoff`, {
  172 |       method: "POST",
  173 |       headers: {
  174 |         "Content-Type": "application/json",
  175 |         "x-aide-conversation-access-token": token || "",
  176 |       },
  177 |       body: JSON.stringify({ reason: "Customer requested human support" }),
  178 |     });
  179 |     return { status: response.status, body: await response.json().catch(() => ({})) };
  180 |   }, { publicKey: agent.publicKey, conversationId });
  181 |   expect(handoffResult.status, JSON.stringify(handoffResult.body)).toBe(200);
  182 |   await expect(frame().getByText(/waiting|human support|connected/i).first()).toBeVisible({ timeout: 15_000 });
  183 | 
  184 |   const loggedInPage = await page.context().newPage();
  185 |   await loggedInPage.goto("/");
  186 |   await loggedInPage.evaluate((publicKey) => {
  187 |     const script = document.createElement("script");
  188 |     script.src = "/embed.js?v=11";
  189 |     script.dataset.aideKey = publicKey;
```