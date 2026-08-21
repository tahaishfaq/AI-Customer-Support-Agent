/**
 * HTTP-only regression for the three security fixes + API matrix.
 * Avoids direct DB (some environments cannot resolve Neon from the test process).
 */
import "dotenv/config";
import { randomUUID } from "node:crypto";

const BASE = (process.env.TEST_BASE_URL || "http://127.0.0.1:3000").replace(
  /\/$/,
  ""
);
const ADMIN_EMAIL = process.env.ADMIN_BOOTSTRAP_EMAIL;
const ADMIN_PASSWORD = process.env.ADMIN_BOOTSTRAP_PASSWORD;

function assert(ok, message) {
  if (!ok) throw new Error(message);
}

function cookieJar() {
  const map = new Map();
  return {
    absorb(res) {
      const list =
        typeof res.headers.getSetCookie === "function"
          ? res.headers.getSetCookie()
          : [];
      for (const raw of list) {
        const pair = raw.split(";")[0];
        const i = pair.indexOf("=");
        if (i > 0) map.set(pair.slice(0, i).trim(), pair.slice(i + 1));
      }
    },
    header() {
      return [...map.entries()].map(([k, v]) => `${k}=${v}`).join("; ");
    },
  };
}

async function json(res) {
  const text = await res.text();
  try {
    return text ? JSON.parse(text) : null;
  } catch {
    return { _raw: text.slice(0, 240) };
  }
}

async function waitForHealth() {
  const deadline = Date.now() + 15_000;
  let last = "no response";
  while (Date.now() < deadline) {
    try {
      const res = await fetch(`${BASE}/api/health`);
      const body = await json(res);
      if (res.ok && body?.database === "ok") return;
      last = `${res.status} ${JSON.stringify(body)}`;
    } catch (error) {
      last = error.message;
    }
    await new Promise((r) => setTimeout(r, 500));
  }
  throw new Error(`Server not ready at ${BASE}/api/health (${last})`);
}

async function signIn(email, password) {
  const jar = cookieJar();
  const csrfRes = await fetch(`${BASE}/api/auth/csrf`);
  jar.absorb(csrfRes);
  const csrf = await json(csrfRes);
  assert(csrf?.csrfToken, "csrf token missing");

  const loginRes = await fetch(`${BASE}/api/auth/callback/credentials`, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Cookie: jar.header(),
    },
    body: new URLSearchParams({
      csrfToken: csrf.csrfToken,
      email,
      password,
      redirect: "false",
    }),
    redirect: "manual",
  });
  jar.absorb(loginRes);

  const sessionRes = await fetch(`${BASE}/api/auth/session`, {
    headers: { Cookie: jar.header() },
  });
  const session = await json(sessionRes);
  return { jar, session, loginStatus: loginRes.status };
}

async function api(jar, path, options = {}) {
  const headers = {
    ...(jar ? { Cookie: jar.header() } : {}),
    ...(options.body ? { "Content-Type": "application/json" } : {}),
    ...(options.headers || {}),
  };
  return fetch(`${BASE}${path}`, { ...options, headers });
}

const passed = [];
const failed = [];
const skipped = [];

async function test(name, fn) {
  try {
    await fn();
    passed.push(name);
    console.log(`PASS  ${name}`);
  } catch (error) {
    failed.push({ name, error: error.message || String(error) });
    console.log(`FAIL  ${name}: ${error.message || error}`);
  }
}

function skip(name, reason) {
  skipped.push({ name, reason });
  console.log(`SKIP  ${name}: ${reason}`);
}

async function loadAgent(jar, agentId) {
  const res = await api(jar, `/api/agents/${agentId}`);
  const body = await json(res);
  assert(res.status === 200, `agent get ${res.status}`);
  return body.agent || body;
}

async function main() {
  await waitForHealth();
  const stamp = Date.now();
  const email = `fix-reg-${stamp}@hapy.test`;
  const password = "FixRegression1!";
  let jar;
  let agentId;
  let publicKey;
  let conversationId;
  let adminJar;
  let settingsBefore;

  // Local mirror of peek vs consume (Bug 2 design)
  const buckets = new Map();
  function isRateLimited(key, { limit, windowMs }) {
    const now = Date.now();
    const existing = buckets.get(key);
    if (!existing || now - existing.start >= windowMs) return { ok: true };
    if (existing.count >= limit) return { ok: false };
    return { ok: true };
  }
  function rateLimit(key, { limit, windowMs }) {
    const now = Date.now();
    const existing = buckets.get(key);
    if (!existing || now - existing.start >= windowMs) {
      buckets.set(key, { start: now, count: 1, windowMs });
      return { ok: true };
    }
    if (existing.count >= limit) return { ok: false };
    existing.count += 1;
    return { ok: true };
  }

  console.log("\n=== Bug 2 unit (peek vs consume) ===\n");
  await test("isRateLimited does not consume", async () => {
    const key = `unit-peek-${stamp}`;
    assert(isRateLimited(key, { limit: 2, windowMs: 60_000 }).ok, "fresh");
    assert(rateLimit(key, { limit: 2, windowMs: 60_000 }).ok, "hit1");
    assert(rateLimit(key, { limit: 2, windowMs: 60_000 }).ok, "hit2");
    assert(!isRateLimited(key, { limit: 2, windowMs: 60_000 }).ok, "blocked");
  });

  console.log("\n=== Core product APIs ===\n");

  await test("GET /api/health", async () => {
    assert((await fetch(`${BASE}/api/health`)).status === 200, "health");
  });

  await test("GET /api/public/platform", async () => {
    assert((await fetch(`${BASE}/api/public/platform`)).status === 200, "platform");
  });

  await test("register + login", async () => {
    const reg = await fetch(`${BASE}/api/auth/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: "Fix Reg",
        email,
        password,
        confirmPassword: password,
      }),
    });
    assert(reg.status === 201, `register ${reg.status}`);
    const result = await signIn(email, password);
    jar = result.jar;
    assert(result.session?.user?.email === email, "session");
  });

  await test("auth/me + workspaces + agents CRUD path", async () => {
    assert((await api(jar, "/api/auth/me")).status === 200, "me");
    assert((await api(jar, "/api/workspaces")).status === 200, "workspaces");
    const create = await api(jar, "/api/agents", {
      method: "POST",
      body: JSON.stringify({
        name: "Origin Lock Agent",
        systemPrompt: "Be short.",
        welcomeMessage: "Hi",
      }),
    });
    const body = await json(create);
    assert(create.status === 201, `create ${create.status} ${JSON.stringify(body)}`);
    agentId = body.id;
    publicKey = body.publicKey;
    if (!publicKey) {
      const agent = await loadAgent(jar, agentId);
      publicKey = agent.publicKey;
    }
    assert(publicKey, "publicKey");
    assert((await api(jar, "/api/agents")).status === 200, "list");
    assert((await api(jar, `/api/agents/${agentId}`)).status === 200, "get");
  });

  await test("knowledge + studio chat + conversations + analytics", async () => {
    const kn = await api(jar, `/api/agents/${agentId}/knowledge`, {
      method: "POST",
      body: JSON.stringify({
        name: "FAQ",
        type: "TEXT",
        content: "Refunds take 5 business days.",
      }),
    });
    assert(kn.status === 201, `knowledge ${kn.status}`);
    assert(
      (await api(jar, `/api/agents/${agentId}/knowledge`)).status === 200,
      "list knowledge"
    );

    const chat = await api(jar, `/api/agents/${agentId}/chat`, {
      method: "POST",
      body: JSON.stringify({ message: "How long do refunds take?" }),
    });
    const chatBody = await json(chat);
    assert(chat.status === 200, `chat ${chat.status} ${JSON.stringify(chatBody)}`);
    conversationId = chatBody.conversationId;

    assert(
      (await api(jar, "/api/conversations?limit=20&offset=0")).status === 200,
      "conversations"
    );
    assert(
      (await api(jar, `/api/conversations/${conversationId}`)).status === 200,
      "conversation"
    );

    for (const path of [
      "/api/analytics/overview",
      `/api/analytics/dashboard?agentId=${agentId}&range=7d`,
      "/api/analytics/topics?range=7d",
      "/api/analytics/sentiment?range=7d",
      "/api/analytics/trends?range=7d",
    ]) {
      assert((await api(jar, path)).status === 200, path);
    }
  });

  console.log("\n=== Bug 1: origin locking ===\n");

  await test("body.origin alone does not lock", async () => {
    const evil = `https://evil-claim-${stamp}.example`;
    const res = await fetch(`${BASE}/api/public/agents/${publicKey}/ping`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ origin: evil }),
    });
    const body = await json(res);
    assert([200, 403].includes(res.status), `status ${res.status}`);
    const agent = await loadAgent(jar, agentId);
    assert(
      agent.siteKnowledgeOrigin !== evil,
      `locked to evil via body: ${agent.siteKnowledgeOrigin}`
    );
    assert(body.origin !== evil, `response claimed evil ${JSON.stringify(body)}`);
  });

  await test("Origin header locks agent", async () => {
    const site = `https://legit-site-${stamp}.example`;
    const res = await fetch(`${BASE}/api/public/agents/${publicKey}/ping`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Origin: site,
      },
      body: JSON.stringify({}),
    });
    const body = await json(res);
    assert(res.status === 200, `ping ${res.status} ${JSON.stringify(body)}`);
    const agent = await loadAgent(jar, agentId);
    assert(
      agent.siteKnowledgeOrigin === site,
      `expected ${site}, got ${agent.siteKnowledgeOrigin}`
    );
  });

  await test("spoofed parentOrigin without Referer → 404", async () => {
    const agent = await loadAgent(jar, agentId);
    const locked = agent.siteKnowledgeOrigin;
    assert(locked, "not locked");
    const res = await fetch(
      `${BASE}/w/${publicKey}?parentOrigin=${encodeURIComponent(locked)}`,
      { redirect: "manual" }
    );
    assert(res.status === 404, `expected 404, got ${res.status}`);
  });

  await test("matching Referer → 200", async () => {
    const agent = await loadAgent(jar, agentId);
    const locked = agent.siteKnowledgeOrigin;
    const res = await fetch(`${BASE}/w/${publicKey}`, {
      headers: { Referer: `${locked}/page` },
      redirect: "manual",
    });
    assert(res.status === 200, `expected 200, got ${res.status}`);
  });

  await test("wrong Referer → 404", async () => {
    const res = await fetch(`${BASE}/w/${publicKey}`, {
      headers: { Referer: `https://other-${stamp}.example/` },
      redirect: "manual",
    });
    assert(res.status === 404, `expected 404, got ${res.status}`);
  });

  let lockedConvoId;
  let lockedAssistantMsgId;

  await test("public chat with app Origin still works", async () => {
    const appOrigin = new URL(BASE).origin;
    const res = await fetch(`${BASE}/api/public/agents/${publicKey}/chat`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Origin: appOrigin,
      },
      body: JSON.stringify({ message: "hi" }),
    });
    const body = await json(res);
    assert(res.status === 200, `chat ${res.status} ${JSON.stringify(body)}`);
    lockedConvoId = body.conversationId || body.conversation?.id;
    lockedAssistantMsgId = body.message?.id || body.assistantMessage?.id;
  });

  await test("locked agent: history/feedback/files need Origin", async () => {
    const agent = await loadAgent(jar, agentId);
    const locked = agent.siteKnowledgeOrigin;
    assert(locked, "not locked");
    assert(lockedConvoId, "missing conversation from chat");

    const histNoOrigin = await fetch(
      `${BASE}/api/public/agents/${publicKey}/conversations/${lockedConvoId}`
    );
    assert(
      histNoOrigin.status === 404,
      `history without Origin expected 404, got ${histNoOrigin.status}`
    );

    const histOk = await fetch(
      `${BASE}/api/public/agents/${publicKey}/conversations/${lockedConvoId}`,
      { headers: { Origin: locked } }
    );
    assert(
      histOk.status === 200,
      `history with Origin ${histOk.status} ${JSON.stringify(await json(histOk))}`
    );

    const fbNoOrigin = await fetch(
      `${BASE}/api/public/agents/${publicKey}/feedback`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messageId: lockedAssistantMsgId || randomUUID(),
          rating: "UP",
        }),
      }
    );
    assert(
      fbNoOrigin.status === 404,
      `feedback without Origin expected 404, got ${fbNoOrigin.status}`
    );

    const fbOk = await fetch(`${BASE}/api/public/agents/${publicKey}/feedback`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Origin: locked,
      },
      body: JSON.stringify({
        messageId: lockedAssistantMsgId || randomUUID(),
        rating: "UP",
      }),
    });
    assert(
      [200, 400, 403].includes(fbOk.status),
      `feedback with Origin must not be agent-404, got ${fbOk.status}`
    );

    const filesNoOrigin = await fetch(
      `${BASE}/api/public/agents/${publicKey}/files`,
      { method: "POST", body: new FormData() }
    );
    assert(
      filesNoOrigin.status === 404,
      `files without Origin expected 404, got ${filesNoOrigin.status}`
    );

    const filesOk = await fetch(
      `${BASE}/api/public/agents/${publicKey}/files`,
      {
        method: "POST",
        headers: { Origin: locked },
        body: new FormData(),
      }
    );
    assert(
      [400, 403].includes(filesOk.status),
      `files with Origin must not be agent-404, got ${filesOk.status}`
    );
  });

  console.log("\n=== Bug 2: admin login HTTP ===\n");

  if (ADMIN_EMAIL && ADMIN_PASSWORD) {
    await test("failed admin guess then successful login", async () => {
      const bad = await signIn(ADMIN_EMAIL, "definitely-wrong-password-zz");
      assert(!bad.session?.user, "wrong password must not session");
      const good = await signIn(ADMIN_EMAIL, ADMIN_PASSWORD);
      assert(
        good.session?.user?.email?.toLowerCase() === ADMIN_EMAIL.toLowerCase(),
        "admin success after failure"
      );
      adminJar = good.jar;
    });
  } else {
    skip("admin login HTTP", "ADMIN_BOOTSTRAP_* not set");
  }

  console.log("\n=== Bug 3: maxWorkspacesPerUser 0 ===\n");

  if (adminJar) {
    await test("cap 1 blocks; cap 0 allows create", async () => {
      const beforeRes = await api(adminJar, "/api/admin/settings");
      const beforeBody = await json(beforeRes);
      assert(beforeRes.status === 200, "get settings");
      settingsBefore = beforeBody.settings || beforeBody;

      const set1 = await api(adminJar, "/api/admin/settings", {
        method: "PUT",
        body: JSON.stringify({ maxWorkspacesPerUser: 1 }),
      });
      assert(set1.status === 200, `put cap1 ${set1.status}`);

      const blocked = await api(jar, "/api/workspaces", {
        method: "POST",
        body: JSON.stringify({ name: `Blocked WS ${stamp}` }),
      });
      assert(
        blocked.status === 400,
        `expected 400 under cap=1, got ${blocked.status} ${JSON.stringify(await json(blocked))}`
      );

      const set0 = await api(adminJar, "/api/admin/settings", {
        method: "PUT",
        body: JSON.stringify({ maxWorkspacesPerUser: 0 }),
      });
      assert(set0.status === 200, `put cap0 ${set0.status}`);

      const allowed = await api(jar, "/api/workspaces", {
        method: "POST",
        body: JSON.stringify({ name: `Unlimited WS ${stamp}` }),
      });
      assert(
        [200, 201].includes(allowed.status),
        `expected create under 0, got ${allowed.status} ${JSON.stringify(await json(allowed))}`
      );

      await api(adminJar, "/api/admin/settings", {
        method: "PUT",
        body: JSON.stringify({
          maxWorkspacesPerUser: settingsBefore.maxWorkspacesPerUser ?? 20,
        }),
      });
    });
  } else {
    skip("workspace soft-cap 0", "no admin session");
  }

  console.log("\n=== Unauth matrix ===\n");

  for (const [method, path, codes] of [
    ["GET", "/api/agents", [401, 403]],
    ["GET", "/api/workspaces", [401, 403]],
    ["GET", "/api/conversations", [401, 403]],
    ["GET", "/api/analytics/overview", [401, 403]],
    ["GET", "/api/admin/users", [401, 403, 404]],
    ["GET", "/api/admin/overview", [401, 403, 404]],
    ["GET", "/api/admin/settings", [401, 403, 404]],
    ["GET", "/api/admin/audit", [401, 403, 404]],
    ["GET", "/api/auth/me", [401, 403]],
  ]) {
    await test(`unauth ${method} ${path}`, async () => {
      const res = await fetch(`${BASE}${path}`, { method });
      assert(codes.includes(res.status), `${path} → ${res.status}`);
    });
  }

  console.log("\n=== Admin GET suite ===\n");

  if (adminJar) {
    for (const path of [
      "/api/admin/overview",
      "/api/admin/users",
      "/api/admin/settings",
      "/api/admin/audit",
      "/api/admin/restore-requests",
      "/api/admin/analytics/dashboard?range=7d",
    ]) {
      await test(`admin GET ${path}`, async () => {
        const res = await api(adminJar, path);
        assert(res.status === 200, `${path} → ${res.status}`);
      });
    }
  } else {
    skip("admin GET suite", "no admin session");
  }

  console.log("\n=== Misc ===\n");

  await test("test-questions + embed regenerate + embed.js", async () => {
    assert(
      [200, 201].includes(
        (
          await api(jar, `/api/agents/${agentId}/test-questions`, {
            method: "POST",
            body: JSON.stringify({}),
          })
        ).status
      ),
      "test-questions"
    );
    const regen = await api(jar, `/api/agents/${agentId}/embed/regenerate`, {
      method: "POST",
      body: JSON.stringify({}),
    });
    assert([200, 201].includes(regen.status), `regen ${regen.status}`);
    const embed = await fetch(`${BASE}/embed.js`);
    assert(embed.status === 200, "embed.js");
    assert((await embed.text()).includes("/ping"), "parent ping in embed.js");
  });

  await test("POST /api/auth/suspended-check", async () => {
    const res = await fetch(`${BASE}/api/auth/suspended-check`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email }),
    });
    assert([200, 400].includes(res.status), `status ${res.status}`);
  });

  console.log("\n========== SUMMARY ==========");
  console.log(`passed  ${passed.length}`);
  console.log(`failed  ${failed.length}`);
  console.log(`skipped ${skipped.length}`);
  if (failed.length) {
    for (const item of failed) console.log(` - ${item.name}: ${item.error}`);
    process.exit(1);
  }
}

main().catch((error) => {
  console.error("regression failed:", error.message || error);
  process.exit(1);
});
