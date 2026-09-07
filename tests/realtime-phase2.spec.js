require("dotenv/config");

const { test, expect } = require("@playwright/test");
const fs = require("node:fs");
const path = require("node:path");
const { randomUUID } = require("node:crypto");
const { execFileSync } = require("node:child_process");
const Redis = require("ioredis");

const socketClientBundle = path.join(
  process.cwd(),
  "node_modules/socket.io-client/dist/socket.io.js"
);

test("one-port app exposes healthy HTTP and realtime readiness", async ({ request }) => {
  const health = await request.get("/healthz");
  expect(health.ok()).toBeTruthy();
  await expect(health.json()).resolves.toMatchObject({ ok: true, service: "aide" });

  const ready = await request.get("/readyz");
  expect(ready.ok()).toBeTruthy();
  await expect(ready.json()).resolves.toMatchObject({ ready: true, service: "aide" });
});

test("logged-out browser keeps protected desk route behind auth", async ({ page }) => {
  const response = await page.goto("/inbox");
  expect(response).not.toBeNull();
  await expect(page).toHaveURL(/\/login/);
});

test("two authenticated browser tabs receive one realtime event", async ({ browser }) => {
  expect(fs.existsSync(socketClientBundle)).toBeTruthy();

  let e2eSession = null;
  if (!process.env.REALTIME_E2E_TOKEN || !process.env.REALTIME_E2E_USER_ID) {
    const output = execFileSync(
      process.execPath,
      [path.join(process.cwd(), "node_modules/tsx/dist/cli.mjs"), "scripts/realtime-e2e-session.js", "issue"],
      { encoding: "utf8", env: process.env }
    );
    e2eSession = JSON.parse(output.trim());
  }
  const token = process.env.REALTIME_E2E_TOKEN || e2eSession.token;
  const userId = process.env.REALTIME_E2E_USER_ID || e2eSession.userId;

  const context = await browser.newContext();
  const first = await context.newPage();
  const second = await context.newPage();
  const pages = [first, second];
  const stream = process.env.REALTIME_STREAM_NAME || "aide:realtime:events";
  const eventType = "billing.subscription.updated";
  const eventId = randomUUID();
  const event = {
    eventId,
    eventType,
    schemaVersion: 1,
    occurredAt: new Date().toISOString(),
    userId,
    workspaceId: null,
    agentId: null,
    conversationId: null,
    aggregateType: "subscription",
    aggregateVersion: 1,
    visibility: "OWNER",
    payload: { browserE2E: true },
  };
  const redis = new Redis(process.env.REALTIME_REDIS_URL, {
    username: process.env.REALTIME_REDIS_USERNAME || undefined,
    password: process.env.REALTIME_REDIS_PASSWORD || undefined,
    maxRetriesPerRequest: 3,
    connectTimeout: 10_000,
  });

  try {
    for (const page of pages) {
      await page.goto("/");
      await page.addScriptTag({ path: socketClientBundle });
      await page.evaluate(
        ({ token, url }) =>
          new Promise((resolve, reject) => {
            const socket = window.io(url, {
              auth: { token },
              transports: ["websocket"],
              timeout: 10_000,
            });
            window.__aideRealtime = socket;
            socket.once("connect", resolve);
            socket.once("connect_error", reject);
          }),
        {
          token,
          url: `http://127.0.0.1:${process.env.PLAYWRIGHT_PORT || 4320}`,
        }
      );
      const joinResult = await page.evaluate(
        (room) =>
          new Promise((resolve) => {
            window.__aideRealtime.emit("room:join", { room }, resolve);
          }),
        `user:${userId}`
      );
      expect(joinResult).toMatchObject({ ok: true, room: `user:${userId}` });
      await page.evaluate((type) => {
        window.__aideReceived = [];
        window.__aideAny = [];
        window.__aideRealtime.on(type, (payload) => window.__aideReceived.push(payload));
        window.__aideRealtime.onAny((name, payload) => window.__aideAny.push({ name, payload }));
      }, eventType);
    }

    await redis.xadd(stream, "*", "event", JSON.stringify(event));
    await expect.poll(() => first.evaluate(() => window.__aideReceived.length), { timeout: 15000 }).toBe(1);
    await expect.poll(() => second.evaluate(() => window.__aideReceived.length)).toBe(1);
    await expect(first.evaluate(() => window.__aideReceived[0].eventId)).resolves.toBe(eventId);
    await expect(second.evaluate(() => window.__aideReceived[0].eventId)).resolves.toBe(eventId);
  } finally {
    await first.evaluate(() => window.__aideRealtime?.disconnect()).catch(() => {});
    await second.evaluate(() => window.__aideRealtime?.disconnect()).catch(() => {});
    await context.close();
    await redis.quit();
    if (e2eSession) {
      execFileSync(
        process.execPath,
        [
          path.join(process.cwd(), "node_modules/tsx/dist/cli.mjs"),
          "scripts/realtime-e2e-session.js",
          "revoke",
          e2eSession.userId,
          e2eSession.sessionId,
        ],
        { stdio: "ignore", env: process.env }
      );
    }
  }
});

test("public embed connects its conversation room with a capability token", async ({ page }) => {
  const output = execFileSync(
    process.execPath,
    [path.join(process.cwd(), "node_modules/tsx/dist/cli.mjs"), "scripts/realtime-public-e2e-access.js"],
    { encoding: "utf8", env: process.env }
  );
  const access = JSON.parse(output.trim());
  const historyKey = `hapy:embed:${access.publicKey}:history`;
  const accessKey = `aide:realtime-access:${access.publicKey}:${access.conversationId}`;

  try {
    await page.addInitScript(
      ({ historyKey: nextHistoryKey, accessKey: nextAccessKey, conversationId, rawToken }) => {
        const now = new Date().toISOString();
        localStorage.setItem(
          nextHistoryKey,
          JSON.stringify({
            conversations: [{ id: conversationId, preview: "Test", startedAt: now, updatedAt: now }],
            activeId: conversationId,
          })
        );
        localStorage.setItem(nextAccessKey, rawToken);
      },
      {
        historyKey,
        accessKey,
        conversationId: access.conversationId,
        rawToken: access.rawToken,
      }
    );
    await page.setExtraHTTPHeaders({
      Referer: `http://localhost:${process.env.PLAYWRIGHT_PORT || 4320}/`,
    });
    await page.goto(`/w/${access.publicKey}`);
    await expect(page.locator('[data-realtime-status="connected"]')).toBeVisible({ timeout: 15000 });
    await expect(page.locator("[data-realtime-conversation]")).toHaveAttribute(
      "data-realtime-conversation",
      access.conversationId
    );
  } finally {
    execFileSync(
      process.execPath,
      [
        path.join(process.cwd(), "node_modules/tsx/dist/cli.mjs"),
        "scripts/realtime-public-e2e-access.js",
        "cleanup",
        access.accessId,
      ],
      { stdio: "ignore", env: process.env }
    );
  }
});
