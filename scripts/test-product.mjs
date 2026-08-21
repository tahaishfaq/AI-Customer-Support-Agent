import "dotenv/config";
import { Pool } from "pg";
import { withVerifyFullSsl } from "../lib/pg-connection.js";

const BASE = (process.env.TEST_BASE_URL || "http://127.0.0.1:3000").replace(
  /\/$/,
  ""
);

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

async function main() {
  await waitForHealth();

  const stamp = Date.now();
  const email = `p0-product-${stamp}@hapy.test`;
  const password = "ProductSmoke1!";
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
  let agentId;
  let conversationId;

  try {
    await test("register", async () => {
      const res = await fetch(`${BASE}/api/auth/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: "Product Smoke",
          email,
          password,
          confirmPassword: password,
        }),
      });
      const body = await json(res);
      assert(
        res.status === 201,
        `register ${res.status} ${JSON.stringify(body)}`
      );
      assert(body?.user?.email === email, "register email");
    });

    await test("login", async () => {
      jar = await signIn(email, password);
    });

    await test("create agent", async () => {
      const res = await api(jar, "/api/agents", {
        method: "POST",
        body: JSON.stringify({
          name: "Smoke Agent",
          systemPrompt: "Answer only from knowledge. Be short.",
          welcomeMessage: "Hi, how can I help?",
        }),
      });
      const body = await json(res);
      assert(res.status === 201, `agent ${res.status} ${JSON.stringify(body)}`);
      agentId = body.id;
      assert(agentId, "agent id");
    });

    await test("TEXT knowledge", async () => {
      const res = await api(jar, `/api/agents/${agentId}/knowledge`, {
        method: "POST",
        body: JSON.stringify({
          name: "Refunds",
          type: "TEXT",
          content: "Refunds are processed within 5 business days.",
        }),
      });
      const body = await json(res);
      assert(res.status === 201, `knowledge ${res.status} ${JSON.stringify(body)}`);
    });

    await test("studio chat", async () => {
      const res = await api(jar, `/api/agents/${agentId}/chat`, {
        method: "POST",
        body: JSON.stringify({
          message: "How long do refunds take?",
        }),
      });
      const body = await json(res);
      assert(res.status === 200, `chat ${res.status} ${JSON.stringify(body)}`);
      conversationId = body.conversationId;
      assert(conversationId, "conversationId");
      assert(body.message?.role === "ASSISTANT", "assistant reply");
      assert(
        typeof body.message?.content === "string" && body.message.content.length > 0,
        "assistant content"
      );
    });

    await test("conversation classified", async () => {
      const res = await api(jar, `/api/conversations/${conversationId}`);
      const body = await json(res);
      assert(res.status === 200, `conversation ${res.status}`);
      const roles = (body.messages || []).map((m) => m.role);
      assert(roles.includes("USER"), "USER message");
      assert(roles.includes("ASSISTANT"), "ASSISTANT message");
      assert(body.category, "category");
      assert(body.sentiment, "sentiment");
    });

    await test("analytics dashboard", async () => {
      const res = await api(
        jar,
        `/api/analytics/dashboard?agentId=${agentId}&range=7d`
      );
      const body = await json(res);
      assert(res.status === 200, `dashboard ${res.status} ${JSON.stringify(body)}`);
      assert(
        (body.overview?.totalConversations || 0) >= 1,
        "dashboard conversations"
      );
    });
  } finally {
    if (process.env.DATABASE_URL) {
      const pool = new Pool({
        connectionString: withVerifyFullSsl(process.env.DATABASE_URL),
      });
      try {
        await pool.query(`DELETE FROM "User" WHERE email = $1`, [email]);
      } finally {
        await pool.end();
      }
    }
  }

  console.log("\n--- product smoke ---");
  console.log(`passed ${passed.length}  failed ${failed.length}`);
  if (failed.length) {
    for (const item of failed) console.log(` - ${item.name}: ${item.error}`);
    process.exit(1);
  }
}

main().catch((error) => {
  console.error("product smoke failed:", error.message || error);
  process.exit(1);
});
