/**
 * Production smoke test against a live Hapy deployment.
 * Usage: node scripts/prod-smoke.mjs [baseUrl]
 */
const BASE = (process.argv[2] || "https://ai-customer-support-agent-ashen.vercel.app").replace(
  /\/$/,
  ""
);

const jar = new Map();
const results = [];

function cookieHeader() {
  return [...jar.entries()].map(([k, v]) => `${k}=${v}`).join("; ");
}

function storeCookies(res) {
  const raw = typeof res.headers.getSetCookie === "function" ? res.headers.getSetCookie() : [];
  const list = raw.length ? raw : (res.headers.get("set-cookie") ? [res.headers.get("set-cookie")] : []);
  for (const line of list) {
    if (!line) continue;
    const part = line.split(";")[0];
    const eq = part.indexOf("=");
    if (eq < 1) continue;
    jar.set(part.slice(0, eq), part.slice(eq + 1));
  }
}

async function req(method, path, { json, form, expect } = {}) {
  const headers = { cookie: cookieHeader() };
  let body;
  if (json !== undefined) {
    headers["content-type"] = "application/json";
    body = JSON.stringify(json);
  }
  if (form) {
    body = form;
  }
  const res = await fetch(`${BASE}${path}`, { method, headers, body, redirect: "manual" });
  storeCookies(res);
  const text = await res.text();
  let data = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = text;
  }
  const item = {
    method,
    path,
    status: res.status,
    location: res.headers.get("location"),
    ok: expect ? expect.includes(res.status) : res.ok,
    expect: expect || [200],
    snippet: typeof data === "string" ? data.slice(0, 180) : JSON.stringify(data)?.slice(0, 240),
  };
  results.push(item);
  return { res, data, item };
}

function pass(name, ok, detail = "") {
  results.push({ name, ok, detail, kind: "check" });
}

const stamp = Date.now();
const email = `hapy.prodtest.${stamp}@example.com`;
const password = "ProdTest9!";

const minimalPdf = Buffer.from(
  "JVBERi0xLjQKJeLjz9MKMSAwIG9iago8PC9UeXBlL0NhdGFsb2cvUGFnZXMgMiAwIFI+PgplbmRvYmoKMiAwIG9iago8PC9UeXBlL1BhZ2VzL0tpZHNbMyAwIFJdL0NvdW50IDE+PgplbmRvYmoKMyAwIG9iago8PC9UeXBlL1BhZ2UvUGFyZW50IDIgMCBSL01lZGlhQm94WzAgMCA2MTIgNzkyXS9Db250ZW50cyA0IDAgUi9SZXNvdXJjZXM8PC9Gb250PDwvRjEgNSAwIFI+Pj4+Pj4KZW5kb2JqCjQgMCBvYmoKPDwvTGVuZ3RoIDQ0Pj4Kc3RyZWFtCkJUIC9GMSAyNCBUZiAxMDAgNzAwIFRkIChIZWxsbyBQREYpIFRqIEVUCmVuZHN0cmVhbQplbmRvYmoKNSAwIG9iago8PC9UeXBlL0ZvbnQvU3VidHlwZS9UeXBlMS9CYXNlRm9udC9IZWx2ZXRpY2E+PgplbmRvYmoKeHJlZgowIDYKMDAwMDAwMDAwMCA2NTUzNSBmIAowMDAwMDAwMDE1IDAwMDAwIG4gCjAwMDAwMDAwNjQgMDAwMDAgbiAKMDAwMDAwMDEyMSAwMDAwMCBuIAowMDAwMDAwMjY0IDAwMDAwIG4gCjAwMDAwMDAzNTggMDAwMDAgbiAKdHJhaWxlcgo8PC9TaXplIDYvUm9vdCAxIDAgUj4+CnN0YXJ0eHJlZgo0MzUKJSVFT0Y=",
  "base64"
);

async function main() {
  console.log(`BASE ${BASE}`);

  const pages = ["/", "/login", "/register", "/embed.js"];
  for (const p of pages) {
    const r = await fetch(`${BASE}${p}`, { redirect: "manual" });
    pass(`page ${p}`, r.status === 200, String(r.status));
  }

  const dash = await fetch(`${BASE}/dashboard`, { redirect: "manual" });
  pass(
    "unauth /dashboard redirects",
    [307, 308, 302].includes(dash.status),
    String(dash.status)
  );

  await req("GET", "/api/health", { expect: [200] });
  await req("GET", "/api/agents", { expect: [401] });
  await req("GET", "/api/auth/session", { expect: [200] });

  await req("POST", "/api/auth/register", {
    json: { name: "X", email: "bad", password: "short", confirmPassword: "no" },
    expect: [400],
  });

  const reg = await req("POST", "/api/auth/register", {
    json: { name: "Prod Tester", email, password, confirmPassword: password },
    expect: [201],
  });
  pass(
    "register has no passwordHash",
    Boolean(reg.data?.user?.id) && !reg.data?.user?.passwordHash && !reg.data?.passwordHash
  );

  await req("POST", "/api/auth/register", {
    json: { name: "Prod Tester", email, password, confirmPassword: password },
    expect: [409],
  });

  const csrf = await req("GET", "/api/auth/csrf", { expect: [200] });
  const csrfToken = csrf.data?.csrfToken;
  pass("csrf token", Boolean(csrfToken));

  const loginBody = new URLSearchParams({
    csrfToken: csrfToken || "",
    email,
    password,
    callbackUrl: `${BASE}/dashboard`,
    json: "true",
  });
  const login = await fetch(`${BASE}/api/auth/callback/credentials`, {
    method: "POST",
    headers: {
      "content-type": "application/x-www-form-urlencoded",
      cookie: cookieHeader(),
    },
    body: loginBody,
    redirect: "manual",
  });
  storeCookies(login);
  pass(
    "credentials login",
    login.status === 200 || login.status === 302,
    String(login.status)
  );

  const me = await req("GET", "/api/auth/me", { expect: [200] });
    pass(
    "session user email",
    me.data?.user?.email === email,
    JSON.stringify(me.data)?.slice(0, 180)
  );

  const created = await req("POST", "/api/agents", {
    json: {
      name: "Hapy Co Support",
      description: "Prod smoke agent",
      systemPrompt:
        "You are Hapy Co support. Answer only from knowledge. Never invent facts.",
      welcomeMessage: "Hi! Welcome to Hapy Co.",
    },
    expect: [201],
  });
  const agentId = created.data?.id;
  pass("agent created", Boolean(agentId), agentId || created.item.snippet);

  if (agentId) {
    await req("GET", `/api/agents/${agentId}`, { expect: [200] });
    const kn = await req("GET", `/api/agents/${agentId}/knowledge`, { expect: [200] });
    pass("knowledge list", kn.item.ok, kn.item.snippet);

    await req("POST", `/api/agents/${agentId}/knowledge`, {
      json: {
        name: "Hapy Co Company FAQ",
        content:
          "Hapy Co builds custom software. MVP Development starts at $8,000. Strategy Call with Hamid M. Chishty.",
      },
      expect: [201],
    });

    const form = new FormData();
    form.append(
      "file",
      new File([minimalPdf], "faq.pdf", { type: "application/pdf" })
    );
    form.append("name", "PDF FAQ");
    const pdfRes = await fetch(`${BASE}/api/agents/${agentId}/knowledge`, {
      method: "POST",
      headers: { cookie: cookieHeader() },
      body: form,
    });
    storeCookies(pdfRes);
    const pdfText = await pdfRes.text();
    pass("PDF upload", pdfRes.status === 201, `${pdfRes.status} ${pdfText.slice(0, 180)}`);

    const chat = await req("POST", `/api/agents/${agentId}/chat`, {
      json: { message: "What is MVP Development pricing?" },
      expect: [200],
    });
    pass(
      "chat reply non-empty",
      Boolean(chat.data?.message?.content),
      chat.item.snippet
    );

    await req("POST", `/api/agents/${agentId}/test-questions`, {
      json: { previousPrompts: [] },
      expect: [200],
    });

    await req("GET", "/api/conversations", { expect: [200] });
    await req("GET", `/api/conversations?agentId=${agentId}`, { expect: [200] });

    const inboxPage = await fetch(`${BASE}/agents/${agentId}/conversations`, {
      headers: { cookie: cookieHeader() },
      redirect: "manual",
    });
    pass(
      "agent conversations page",
      inboxPage.status === 200,
      String(inboxPage.status)
    );

    const legacyInbox = await fetch(`${BASE}/conversations`, {
      headers: { cookie: cookieHeader() },
      redirect: "manual",
    });
    pass(
      "legacy /conversations redirects",
      [307, 308, 302].includes(legacyInbox.status),
      `${legacyInbox.status} ${legacyInbox.headers.get("location") || ""}`
    );

    const convoId = chat.data?.conversationId;
    if (convoId) {
      const threadPage = await fetch(
        `${BASE}/agents/${agentId}/conversations/${convoId}`,
        { headers: { cookie: cookieHeader() }, redirect: "manual" }
      );
      pass(
        "agent conversation thread page",
        threadPage.status === 200,
        String(threadPage.status)
      );
    }
    await req("GET", "/api/analytics/overview", { expect: [200] });
    await req("GET", "/api/analytics/dashboard", { expect: [200] });
    await req("GET", "/api/analytics/sentiment", { expect: [200] });
    await req("GET", "/api/analytics/topics", { expect: [200] });
    await req("GET", "/api/analytics/trends", { expect: [200] });

    const agent = created.data;
    const publicKey = agent?.publicKey;
    pass("publicKey present", Boolean(publicKey), publicKey || "missing");
    if (publicKey) {
      await req("GET", `/w/${publicKey}`, { expect: [200] });
      await req("POST", `/api/public/agents/${publicKey}/chat`, {
        json: { message: "Hello" },
        expect: [200],
      });
      await req("POST", `/api/public/agents/${publicKey}/ping`, {
        json: { origin: "https://example.com" },
        expect: [200, 202, 204, 400],
      });
    }

    await req("DELETE", `/api/agents/${agentId}`, { expect: [200, 204] });
  }

  const failed = results.filter((r) => {
    if (r.kind === "check") return !r.ok;
    return r.ok === false;
  });

  console.log(JSON.stringify({ base: BASE, email, failed: failed.length, results }, null, 2));
  process.exit(failed.length ? 1 : 0);
}

main().catch((err) => {
  console.error(err);
  process.exit(2);
});
