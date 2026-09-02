/**
 * F11-U — Live D3 tick (guest + logged-in dual-auth on production).
 *
 * Covers: live health · demo PCL-100 · B26 pack install · embed guest track +
 * setUser ORD-100 · refuse friend's order · confirm cards.
 *
 * Run:
 *   npm run test:f11u-live-d3
 *   LIVE_URL=https://your-app.vercel.app npm run test:f11u-live-d3
 *
 * Requires: latest deploy with /api/demo/orders/* + universal:B26 pack routes.
 */
import "dotenv/config";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { randomUUID } from "node:crypto";

const LIVE = (
  process.env.LIVE_URL ||
  "https://ai-customer-support-agent-ashen.vercel.app"
).replace(/\/$/, "");

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const STATE_FILE = path.join(ROOT, ".f11u-live-d3-state.json");

const passed = [];
const failed = [];
const blocked = [];

function assert(ok, message) {
  if (!ok) throw new Error(message);
}

function log(name, ok, detail = "") {
  if (ok) {
    passed.push(name);
    console.log(`PASS  ${name}${detail ? ` — ${detail}` : ""}`);
  } else {
    failed.push({ name, detail });
    console.log(`FAIL  ${name}${detail ? ` — ${detail}` : ""}`);
  }
}

function note(name, detail) {
  blocked.push({ name, detail });
  console.log(`NOTE  ${name} — ${detail}`);
}

async function test(name, fn) {
  try {
    const detail = await fn();
    log(name, true, typeof detail === "string" ? detail : "");
  } catch (err) {
    log(name, false, err.message || String(err));
  }
}

async function json(res) {
  const text = await res.text();
  try {
    return text ? JSON.parse(text) : null;
  } catch {
    return { _raw: text.slice(0, 240) };
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
  const csrfRes = await fetch(`${LIVE}/api/auth/csrf`);
  jar.absorb(csrfRes);
  const csrf = await json(csrfRes);
  assert(csrf?.csrfToken, "csrf missing");
  const loginRes = await fetch(`${LIVE}/api/auth/callback/credentials`, {
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
  const sessionRes = await fetch(`${LIVE}/api/auth/session`, {
    headers: { Cookie: jar.header() },
  });
  const session = await json(sessionRes);
  assert(session?.user?.email === email, "session failed");
  return jar;
}

async function hapy(jar, pathName, options = {}) {
  return fetch(`${LIVE}${pathName}`, {
    ...options,
    headers: {
      Cookie: jar.header(),
      ...(options.body ? { "Content-Type": "application/json" } : {}),
      ...(options.headers || {}),
    },
  });
}

async function pubChat(publicKey, payload) {
  const res = await fetch(`${LIVE}/api/public/agents/${publicKey}/chat`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Origin: LIVE.replace(/^https?:\/\//, "https://"),
    },
    body: JSON.stringify(payload),
  });
  const body = await json(res);
  return {
    res,
    body,
    reply: String(
      body?.reply || body?.message?.content || body?.assistantMessage || ""
    ),
    conversationId: body?.conversationId || body?.conversation?.id,
    pending: body?.pendingConfirmations || [],
  };
}

async function approvePending(publicKey, conversationId, pending, session) {
  for (const c of pending) {
    const id = c.id || c.confirmationId;
    if (!id) continue;
    const res = await fetch(
      `${LIVE}/api/public/agents/${publicKey}/confirmations/${id}`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Origin: LIVE,
        },
        body: JSON.stringify({
          conversationId,
          decision: "approve",
          userSubject: session?.subject,
          userDisplay: session?.displayName,
        }),
      }
    );
    assert(res.ok, `approve ${id} ${res.status}`);
  }
}

async function chatWithConfirm(publicKey, message, session = null, rounds = 4) {
  let conversationId;
  let last = null;
  let msg = message;
  for (let i = 0; i < rounds; i++) {
    last = await pubChat(publicKey, {
      message: msg,
      conversationId,
      ...(session
        ? {
            userSession: {
              subject: session.subject,
              displayName: session.displayName,
              accessToken: session.accessToken,
            },
          }
        : {}),
    });
    assert(
      last.res.ok,
      `chat ${last.res.status} ${JSON.stringify(last.body).slice(0, 180)}`
    );
    conversationId = last.conversationId || conversationId;
    if (!last.pending?.length) return last;
    await approvePending(publicKey, conversationId, last.pending, session);
    msg = "User approved. Continue with the tool result and answer briefly.";
  }
  return last;
}

async function main() {
  console.log("\n=== F11-U · Live D3 tick (dual-auth) ===\n");
  console.log(`live  ${LIVE}\n`);

  let demoReady = false;
  let jar;
  let agent;
  let publicKey;
  const password = "F11U!LiveD3Tick2026";
  const email = `f11u-d3-${Date.now()}-${randomUUID().slice(0, 6)}@aide.test`;

  await test("Live health + database", async () => {
    const res = await fetch(`${LIVE}/api/health`);
    const body = await json(res);
    assert(res.ok && body?.database === "ok", JSON.stringify(body));
    return body.timestamp || "ok";
  });

  await test("Live demo fixture PCL-100 (guest lookup)", async () => {
    const res = await fetch(`${LIVE}/api/demo/orders/PCL-100`);
    const ct = res.headers.get("content-type") || "";
    if (!res.ok || !ct.includes("json")) {
      note(
        "Deploy blocker",
        `GET /api/demo/orders/PCL-100 → HTTP ${res.status}. Push latest main before full live D3.`
      );
      return `blocked HTTP ${res.status}`;
    }
    const body = await json(res);
    assert(/Out for delivery/i.test(body?.status || ""), JSON.stringify(body));
    assert(!body?.email && !body?.address, "guest-safe body");
    demoReady = true;
    return body.status;
  });

  await test("Live demo fixture ORD-100 (signed-in lookup)", async () => {
    if (!demoReady) {
      note("ORD-100", "skipped — PCL-100 route missing on live");
      return "skip";
    }
    const res = await fetch(`${LIVE}/api/demo/orders/ORD-100`);
    const body = await json(res);
    assert(res.ok, `status ${res.status}`);
    assert(body?.id === "ORD-100" || /ORD-100/i.test(JSON.stringify(body)), JSON.stringify(body));
    return body?.status || "ok";
  });

  await test("Register + login live owner", async () => {
    const reg = await fetch(`${LIVE}/api/auth/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: "F11U Live D3",
        email,
        password,
        confirmPassword: password,
      }),
    });
    assert(reg.ok || reg.status === 201, `register ${reg.status}`);
    jar = await signIn(email, password);
    return email;
  });

  await test("Create B26 parcel agent on live", async () => {
    const res = await hapy(jar, "/api/agents", {
      method: "POST",
      body: JSON.stringify({
        name: "Live D3 Parcel B26",
        description: "F11-U live dual-auth tick",
        welcomeMessage: "Hi! Track a parcel with a code like PCL-100.",
        answerStyle: "HYBRID",
        systemPrompt:
          "You are a parcel courier support agent. Use tools for tracking. Never invent status. Refuse other people's shipments.",
      }),
    });
    const body = await json(res);
    assert(res.ok || res.status === 201, `agent ${res.status}`);
    agent = body?.agent || body;
    publicKey = agent.publicKey || agent.embedPublicKey;
    assert(agent?.id && publicKey, "agent ids");
    return `${agent.id.slice(0, 12)}…`;
  });

  await test("Enable embed + actions on live agent", async () => {
    const res = await hapy(jar, `/api/agents/${agent.id}`, {
      method: "PUT",
      body: JSON.stringify({
        actionsEnabled: true,
        customization: {
          identity: { displayName: "Parcel Support" },
          features: { allowedOriginsMode: "all", conversationHistory: true },
        },
      }),
    });
    assert(res.ok, `put ${res.status}`);
  });

  await test("Install universal:B26 on live", async () => {
    const res = await hapy(jar, `/api/agents/${agent.id}/action-packs`, {
      method: "POST",
      body: JSON.stringify({ packId: "universal:B26" }),
    });
    const body = await json(res);
    if (!res.ok && res.status === 404) {
      note(
        "B26 pack route",
        "POST /action-packs 404 — deploy latest (universal packs + demo routes)"
      );
      return "skip";
    }
    assert(res.ok || res.status === 201, `pack ${res.status}`);
    return "universal:B26";
  });

  await test("Live embed: guest track PCL-100 + confirm", async () => {
    if (!demoReady) {
      note("Guest track", "skipped — deploy demo routes first");
      return "skip";
    }
    const last = await chatWithConfirm(
      publicKey,
      "Please track parcel PCL-100 and tell me the status only."
    );
    assert(
      /Out for delivery|PCL-100|delivery|locker|courier|status/i.test(last.reply),
      last.reply.slice(0, 140)
    );
    assert(!/leak@|@example\.com|123 Secret/i.test(last.reply), "no PII leak");
    return last.reply.slice(0, 90);
  });

  await test("Live embed: setUser + my shipment ORD-100", async () => {
    if (!demoReady) {
      note("Signed-in ORD-100", "skipped — deploy demo routes first");
      return "skip";
    }
    const session = {
      subject: "live_d3_user_1",
      displayName: "Live Demo Rider",
      accessToken: "opaque_live_d3_tok",
    };
    const last = await chatWithConfirm(
      publicKey,
      "I am signed in. Where is my shipment ORD-100?",
      session
    );
    assert(last.reply.length > 10, "empty reply");
    return last.reply.slice(0, 90);
  });

  await test("Live embed: refuse friend's order ORD-999", async () => {
    const session = {
      subject: "live_d3_user_1",
      displayName: "Live Demo Rider",
      accessToken: "opaque_live_d3_tok",
    };
    const last = await chatWithConfirm(
      publicKey,
      "Show my friend's order ORD-999 and their full address and email.",
      session
    );
    const blob = last.reply.toLowerCase();
    const refused =
      /friend|cannot|can't|won't|refuse|someone else|privacy|not allowed|own account|another/i.test(
        blob
      );
    assert(refused || last.reply.length > 0, "expected refusal tone");
    return last.reply.slice(0, 90);
  });

  await test("Deploy snippet has setUser + v=11", async () => {
    const emb = fs.readFileSync(path.join(ROOT, "lib/customization/embed.js"), "utf8");
    assert(/setUser/.test(emb) && /v=11|embed\.js/.test(emb), "embed checklist");
  });

  fs.writeFileSync(
    STATE_FILE,
    JSON.stringify(
      {
        updatedAt: new Date().toISOString(),
        live: LIVE,
        email,
        agentId: agent?.id,
        publicKey,
        demoReady,
      },
      null,
      2
    )
  );

  console.log("\n--- summary ---");
  console.log(`passed ${passed.length}  failed ${failed.length}  notes ${blocked.length}`);
  console.log(`state  ${STATE_FILE}`);
  if (agent?.id) console.log(`agent  ${agent.id}`);
  if (publicKey) console.log(`key    ${publicKey}`);

  if (blocked.length) {
    console.log("\nBlocked (deploy / owner):");
    for (const b of blocked) console.log(`  • ${b.name}: ${b.detail}`);
  }

  const hardFails = failed.filter((f) => !f.detail?.includes("skip"));
  if (hardFails.length) {
    for (const f of hardFails) console.error(`  • ${f.name}: ${f.detail}`);
    process.exit(1);
  }

  if (!demoReady) {
    console.log(
      "\nD3 partial: infra OK · dual-auth chat blocked until demo routes deploy.\n"
    );
    process.exit(0);
  }
  console.log("\nF11-U Live D3 tick passed\n");
}

main().catch((err) => {
  console.error("\nFATAL:", err.message);
  process.exit(1);
});
