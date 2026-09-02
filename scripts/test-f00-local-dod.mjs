/**
 * F00 — Local DoD ticks (automatable rows from F00_PROGRESS.md).
 *
 * Run: npm run test:f00-local
 * Requires: local dev on TEST_BASE_URL (default http://127.0.0.1:3000)
 */
import "dotenv/config";
import { randomUUID } from "node:crypto";
import { resolveTestBaseUrl } from "./lib/test-base-url.mjs";
import { uniqueTestIpHeaders } from "./lib/test-client-ip.mjs";

const BASE = resolveTestBaseUrl();
const passed = [];
const failed = [];

function assert(ok, message) {
  if (!ok) throw new Error(message);
}

async function test(name, fn) {
  try {
    await fn();
    passed.push(name);
    console.log(`PASS  ${name}`);
  } catch (err) {
    failed.push({ name, error: err.message });
    console.log(`FAIL  ${name} — ${err.message}`);
  }
}

async function json(res) {
  const text = await res.text();
  try {
    return text ? JSON.parse(text) : null;
  } catch {
    return { _raw: text.slice(0, 200) };
  }
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

async function signIn(email, password) {
  const jar = cookieJar();
  const csrfRes = await fetch(`${BASE}/api/auth/csrf`);
  jar.absorb(csrfRes);
  const csrf = await json(csrfRes);
  assert(csrf?.csrfToken, "csrf");
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
  return jar;
}

async function api(jar, pathName, options = {}) {
  return fetch(`${BASE}${pathName}`, {
    ...options,
    headers: {
      Cookie: jar.header(),
      ...(options.body ? { "Content-Type": "application/json" } : {}),
    },
  });
}

async function main() {
  console.log("\n=== F00 · Local DoD (automated) ===\n");
  console.log(`base  ${BASE}\n`);

  const password = "F00Local!DoD2026";
  const email = `f00-local-${Date.now()}-${randomUUID().slice(0, 6)}@aide.test`;
  let jar;
  let agentId;
  let conversationId;

  await test("DoD #1 Register + login", async () => {
    const reg = await fetch(`${BASE}/api/auth/register`, {
      method: "POST",
      headers: uniqueTestIpHeaders({ "Content-Type": "application/json" }),
      body: JSON.stringify({
        name: "F00 Local",
        email,
        password,
        confirmPassword: password,
      }),
    });
    assert(reg.ok || reg.status === 201, `register ${reg.status}`);
    jar = await signIn(email, password);
  });

  await test("DoD #2 Create agent", async () => {
    const res = await api(jar, "/api/agents", {
      method: "POST",
      body: JSON.stringify({
        name: "F00 Local DoD Agent",
        systemPrompt: "Answer from knowledge only.",
        welcomeMessage: "Hi",
      }),
    });
    const body = await json(res);
    assert(res.status === 201, `agent ${res.status}`);
    agentId = body.id;
    assert(agentId, "agent id");
  });

  await test("DoD #3 Add TEXT knowledge", async () => {
    const res = await api(jar, `/api/agents/${agentId}/knowledge`, {
      method: "POST",
      body: JSON.stringify({
        name: "Hours",
        type: "TEXT",
        content: "Support hours are 9am–5pm Monday to Friday.",
      }),
    });
    assert(res.status === 201, `knowledge ${res.status}`);
  });

  await test("DoD #4 Studio chat", async () => {
    const res = await api(jar, `/api/agents/${agentId}/chat`, {
      method: "POST",
      body: JSON.stringify({ message: "What are your support hours?" }),
    });
    const body = await json(res);
    assert(res.status === 200, `chat ${res.status}`);
    conversationId = body.conversationId;
    assert(body.message?.content?.length > 0, "assistant reply");
  });

  await test("DoD #5–7 Conversation persisted + metadata", async () => {
    let body;
    let res;
    for (let i = 0; i < 10; i++) {
      res = await api(jar, `/api/conversations/${conversationId}`);
      body = await json(res);
      if (res.status === 200 && body.messages?.length >= 2) break;
      await new Promise((r) => setTimeout(r, 400));
    }
    assert(res.status === 200, `conversation ${res.status}`);
    const roles = (body.messages || []).map((m) => m.role);
    assert(roles.includes("USER") && roles.includes("ASSISTANT"), "roles");
    const hasMeta = body.messages.some((m) => m.createdAt);
    assert(hasMeta, "message timestamps");
  });

  await test("DoD #8 Sentiment (+ category classify lag ok)", async () => {
    let body;
    for (let i = 0; i < 12; i++) {
      const res = await api(jar, `/api/conversations/${conversationId}`);
      body = await json(res);
      if (body.sentiment && body.category) break;
      await new Promise((r) => setTimeout(r, 500));
    }
    assert(body.sentiment, `sentiment missing`);
    assert(body.category, `category missing`);
  });

  await test("DoD #9–11 Analytics dashboard + insights APIs", async () => {
    const endpoints = [
      `/api/analytics/dashboard?agentId=${agentId}&range=7d`,
      `/api/analytics/overview?range=7d`,
      `/api/analytics/sentiment?range=7d`,
      `/api/analytics/topics?range=7d`,
      `/api/analytics/trends?range=7d`,
    ];
    for (const path of endpoints) {
      const res = await api(jar, path);
      const body = await json(res);
      assert(res.status === 200, `${path} → ${res.status}`);
      assert(body && typeof body === "object", `${path} body`);
    }
    const dash = await json(
      await api(jar, `/api/analytics/dashboard?agentId=${agentId}&range=7d`)
    );
    assert(
      dash.overview != null || dash.kpis != null || dash.charts != null,
      "dashboard shape"
    );
  });

  await test("DoD #13 Friendly 401 (no stack trace)", async () => {
    const res = await fetch(`${BASE}/api/agents`);
    const body = await json(res);
    assert(res.status === 401 || res.status === 403, `expected 401 got ${res.status}`);
    const raw = JSON.stringify(body);
    assert(!/stack|Traceback|at\s+\w+\./i.test(raw), "no stack in JSON");
    assert(body?.error?.message || body?.message, "friendly message");
  });

  await test("DoD #15 README + demo route local", async () => {
    const readme = await import("node:fs").then((fs) =>
      fs.readFileSync(new URL("../README.md", import.meta.url), "utf8")
    );
    assert(/DATABASE_URL/.test(readme), "README env");
    assert(/embed/.test(readme), "README embed");
    const demo = await fetch(`${BASE}/api/demo/orders/PCL-100`);
    assert(demo.ok, `demo PCL-100 ${demo.status}`);
  });

  console.log("\n--- summary ---");
  console.log(`passed ${passed.length}  failed ${failed.length}`);
  console.log("\nManual still: #12 responsive 375/1280 · #16 git hygiene · #17 code review\n");

  if (failed.length) {
    for (const f of failed) console.error(`  • ${f.name}: ${f.error}`);
    process.exit(1);
  }
  console.log("F00 local DoD automated ticks passed\n");
}

main().catch((err) => {
  console.error("\nFATAL:", err.message);
  process.exit(1);
});
