/**
 * F12 Human Desk — live end-to-end flow (new embed user → handoff → human → resolve).
 * Run: npm run dev  then  npm run test:f12e2e
 */
import "dotenv/config";
import { randomUUID } from "node:crypto";
import { Pool } from "pg";
import { withVerifyFullSsl } from "../lib/pg-connection.js";

function resolveTestBaseUrl() {
  const raw = process.env.TEST_BASE_URL || "http://127.0.0.1:3000";
  const match = String(raw).match(/https?:\/\/[^\s|]+/i);
  return (match ? match[0] : "http://127.0.0.1:3000").replace(/\/$/, "");
}

const BASE = resolveTestBaseUrl();
const EMBED_ORIGIN = process.env.TEST_EMBED_ORIGIN || "http://127.0.0.1:3000";

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
    return { _raw: text.slice(0, 400) };
  }
}

async function waitForHealth() {
  const deadline = Date.now() + 20_000;
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
  assert(session?.user?.email === email, "session email mismatch");
  return jar;
}

async function api(jar, path, options = {}) {
  const headers = {
    Cookie: jar.header(),
    ...(options.body ? { "Content-Type": "application/json" } : {}),
    ...(options.headers || {}),
  };
  return fetch(`${BASE}${path}`, { ...options, headers });
}

async function publicApi(path, options = {}) {
  return fetch(`${BASE}${path}`, {
    ...options,
    headers: {
      Origin: EMBED_ORIGIN,
      ...(options.body ? { "Content-Type": "application/json" } : {}),
      ...(options.headers || {}),
    },
  });
}

async function registerUser(name, email, password) {
  const res = await fetch(`${BASE}/api/auth/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      name,
      email,
      password,
      confirmPassword: password,
    }),
  });
  return { res, body: await json(res) };
}

async function main() {
  await waitForHealth();

  const stamp = `${Date.now()}-${randomUUID().slice(0, 8)}`;
  const email = `f12-desk-${stamp}@hapy.test`;
  const emailB = `f12-desk-b-${stamp}@hapy.test`;
  const password = "DeskE2E1!";
  const emailsToClean = [email, emailB];
  const passed = [];
  const failed = [];

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

  let jar;
  let jarB;
  let agentId;
  let publicKey;
  let conversationId;

  try {
    await test("register owner", async () => {
      const { res, body } = await registerUser("Desk E2E", email, password);
      assert(res.status === 201, `register ${res.status} ${JSON.stringify(body)}`);
    });

    await test("login owner", async () => {
      jar = await signIn(email, password);
    });

    await test("create agent with public key", async () => {
      const res = await api(jar, "/api/agents", {
        method: "POST",
        body: JSON.stringify({
          name: "Desk E2E Agent",
          systemPrompt: "You are a helpful assistant. Be brief.",
          welcomeMessage: "Hi! How can I help?",
        }),
      });
      const body = await json(res);
      assert(res.status === 201, `agent ${res.status} ${JSON.stringify(body)}`);
      agentId = body.id;
      publicKey = body.publicKey;
      assert(publicKey, "publicKey on create");
    });

    await test("keyword handoff from embed chat", async () => {
      const res = await publicApi(`/api/public/agents/${publicKey}/chat`, {
        method: "POST",
        body: JSON.stringify({
          message: "I need to talk to a human please",
        }),
      });
      const body = await json(res);
      assert(res.status === 200, `pub chat ${res.status} ${JSON.stringify(body)}`);
      conversationId = body.conversationId;
      assert(conversationId, "conversationId");
      assert(body.handoffTriggered === true, "handoffTriggered");
      assert(body.waitingForHuman === true, "waitingForHuman");
      assert(body.aiPaused === true, "aiPaused");
      assert(body.message?.content?.includes("connecting you"), "handoff ack");
    });

    await test("AI blocked while waiting for human", async () => {
      const res = await publicApi(`/api/public/agents/${publicKey}/chat`, {
        method: "POST",
        body: JSON.stringify({
          message: "Are you still there?",
          conversationId,
        }),
      });
      const body = await json(res);
      assert(res.status === 200, `paused chat ${res.status}`);
      assert(body.aiPaused === true, "still aiPaused");
      assert(body.message == null, "no AI reply while waiting");
    });

    await test("button handoff path (idempotent while waiting)", async () => {
      const res = await publicApi(
        `/api/public/agents/${publicKey}/conversations/${conversationId}/handoff`,
        {
          method: "POST",
          body: JSON.stringify({ reason: "Button test" }),
        }
      );
      const body = await json(res);
      assert(res.status === 200, `handoff ${res.status} ${JSON.stringify(body)}`);
      assert(body.waitingForHuman === true, "still waiting");
    });

    await test("inbox lists waiting conversation", async () => {
      const res = await api(jar, "/api/inbox?status=WAITING_HUMAN");
      const body = await json(res);
      assert(res.status === 200, `inbox ${res.status}`);
      const found = (body.conversations || []).some((c) => c.id === conversationId);
      assert(found, "conversation in owner inbox");
      assert(body.conversations[0]?.waitingForHuman !== undefined, "desk state on row");
    });

    await test("inbox count includes waiting", async () => {
      const res = await api(jar, "/api/inbox/count");
      const body = await json(res);
      assert(res.status === 200, `count ${res.status}`);
      assert((body.waiting || 0) >= 1, "waiting count >= 1");
    });

    await test("owner sends human reply", async () => {
      const res = await api(jar, `/api/conversations/${conversationId}/messages`, {
        method: "POST",
        body: JSON.stringify({ message: "Hi, this is Sam from support. How can I help?" }),
      });
      const body = await json(res);
      assert(res.status === 201, `human reply ${res.status} ${JSON.stringify(body)}`);
      assert(body.message?.role === "HUMAN", "HUMAN role");
    });

    await test("embed poll shows human reply", async () => {
      const res = await publicApi(
        `/api/public/agents/${publicKey}/conversations/${conversationId}`
      );
      const body = await json(res);
      assert(res.status === 200, `public conv ${res.status}`);
      assert(body.hasHumanReply === true, "hasHumanReply");
      const human = (body.messages || []).find((m) => m.role === "HUMAN");
      assert(human?.content?.includes("Sam from support"), "human message visible");
      assert(body.handoffEligible === false, "not eligible while waiting");
    });

    await test("owner resolves and returns to AI", async () => {
      const res = await api(jar, `/api/conversations/${conversationId}/resolve`, {
        method: "POST",
        body: JSON.stringify({ resumeAi: true }),
      });
      const body = await json(res);
      assert(res.status === 200, `resolve ${res.status} ${JSON.stringify(body)}`);
      assert(body.status === "OPEN", "status OPEN");
      assert(body.aiPaused === false, "ai resumed");
      assert(body.waitingForHuman === false, "not waiting");
    });

    await test("re-handoff blocked by 30m cooldown", async () => {
      const res = await publicApi(
        `/api/public/agents/${publicKey}/conversations/${conversationId}/handoff`,
        { method: "POST", body: JSON.stringify({}) }
      );
      const body = await json(res);
      assert(res.status === 429, `cooldown expected 429, got ${res.status}`);
      assert(body.error?.message?.includes("wait"), "cooldown message");
    });

    await test("workspace B cannot see inbox A", async () => {
      const { res: reg } = await registerUser("Desk B", emailB, password);
      assert(reg.status === 201, "register B");
      jarB = await signIn(emailB, password);
      const res = await api(jarB, "/api/inbox?status=WAITING_HUMAN");
      const body = await json(res);
      assert(res.status === 200, "inbox B");
      const leak = (body.conversations || []).some((c) => c.id === conversationId);
      assert(!leak, "workspace isolation");
    });

    await test("public conversation exposes desk eligibility fields", async () => {
      const res = await publicApi(
        `/api/public/agents/${publicKey}/conversations/${conversationId}`
      );
      const body = await json(res);
      assert(res.status === 200, "public get");
      assert(typeof body.handoffEligible === "boolean", "handoffEligible");
      assert(typeof body.handoffRemaining === "number", "handoffRemaining");
      assert(body.handoffCount >= 1, "handoffCount persisted");
    });
  } finally {
    if (process.env.DATABASE_URL) {
      const pool = new Pool({
        connectionString: withVerifyFullSsl(process.env.DATABASE_URL),
      });
      try {
        for (const e of emailsToClean) {
          await pool.query(`DELETE FROM "User" WHERE email = $1`, [e]);
        }
      } finally {
        await pool.end();
      }
    }
  }

  console.log("\n--- F12 desk E2E ---");
  console.log(`BASE ${BASE}  ORIGIN ${EMBED_ORIGIN}`);
  console.log(`passed ${passed.length}  failed ${failed.length}`);
  if (failed.length) {
    for (const item of failed) console.log(` - ${item.name}: ${item.error}`);
    process.exit(1);
  }
}

main().catch((error) => {
  console.error("\nF12 E2E FAILED:", error.message || error);
  process.exit(1);
});
