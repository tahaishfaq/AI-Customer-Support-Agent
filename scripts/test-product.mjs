import "dotenv/config";
import { randomUUID } from "node:crypto";
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
  const body = await json(res);
  return { res, body };
}

async function main() {
  await waitForHealth();

  if (/localhost|127\.0\.0\.1/i.test(BASE) && process.env.CI === "true") {
    console.warn(
      "WARN  TEST_BASE_URL is localhost in CI — prefer a Vercel preview URL (F03-E)."
    );
  }

  // Unique per run so parallel PR smokes do not collide (F03-F).
  const stamp = `${Date.now()}-${randomUUID().slice(0, 8)}`;
  const email = `p0-product-${stamp}@hapy.test`;
  const emailB = `p0-product-b-${stamp}@hapy.test`;
  const password = "ProductSmoke1!";
  const knowledgePhrase = "5 business days";
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
  let conversationId;

  try {
    await test("register", async () => {
      const { res, body } = await registerUser("Product Smoke", email, password);
      assert(
        res.status === 201,
        `register ${res.status} ${JSON.stringify(body)}`
      );
      assert(body?.user?.email === email, "register email");
    });

    await test("reserved admin email cannot register", async () => {
      const adminEmail = process.env.ADMIN_BOOTSTRAP_EMAIL?.trim();
      if (!adminEmail) {
        console.log("  skip (ADMIN_BOOTSTRAP_EMAIL unset)");
        return;
      }
      const { res, body } = await registerUser(
        "Should Fail",
        adminEmail,
        password
      );
      assert(
        res.status === 409,
        `reserved admin register expected 409, got ${res.status} ${JSON.stringify(body)}`
      );
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
          content: `Refunds are processed within ${knowledgePhrase}.`,
        }),
      });
      const body = await json(res);
      assert(res.status === 201, `knowledge ${res.status} ${JSON.stringify(body)}`);
    });

    // One OpenAI call max for this smoke (F03-E).
    await test("studio FAQ chat uses knowledge", async () => {
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
      const content = String(body.message?.content || "");
      assert(content.length > 0, "assistant content");
      assert(
        /5\s*business\s*days|refund/i.test(content),
        `assistant should reflect knowledge (got: ${content.slice(0, 120)})`
      );
    });

    await test("conversation persisted (+ classify lag ok)", async () => {
      let body;
      let res;
      for (let i = 0; i < 8; i += 1) {
        res = await api(jar, `/api/conversations/${conversationId}`);
        body = await json(res);
        if (res.status === 200 && body.category && body.sentiment) break;
        await new Promise((r) => setTimeout(r, 500));
      }
      assert(res.status === 200, `conversation ${res.status}`);
      const roles = (body.messages || []).map((m) => m.role);
      assert(roles.includes("USER"), "USER message");
      assert(roles.includes("ASSISTANT"), "ASSISTANT message");
      assert(body.category, "category (may lag after-return classify)");
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

    await test("workspace isolation — other user 404 on agent", async () => {
      const { res: reg, body: regBody } = await registerUser(
        "Product Smoke B",
        emailB,
        password
      );
      assert(
        reg.status === 201,
        `register B ${reg.status} ${JSON.stringify(regBody)}`
      );
      jarB = await signIn(emailB, password);
      const res = await api(jarB, `/api/agents/${agentId}`);
      const body = await json(res);
      assert(
        res.status === 404 || res.status === 403,
        `cross-user agent expected 404/403, got ${res.status} ${JSON.stringify(body)}`
      );
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

  console.log("\n--- product smoke ---");
  console.log(`BASE ${BASE}`);
  console.log(`passed ${passed.length}  failed ${failed.length}`);
  if (failed.length) {
    console.log("Failed steps:");
    for (const item of failed) console.log(` - ${item.name}: ${item.error}`);
    process.exit(1);
  }
}

main().catch((error) => {
  console.error("\nproduct smoke FAILED:", error.message || error);
  process.exit(1);
});
