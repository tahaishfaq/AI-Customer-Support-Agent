/**
 * PChat (react-firebase-chat) ↔ Aide: agent + embed + edge suite.
 *
 * Prereqs: Aide :3000 · PChat :3002 (PORT=3002 npm start)
 * Run: npm run test:pchat-local
 */
import "dotenv/config";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { randomUUID } from "node:crypto";
import { evaluateActionPolicy } from "../lib/actions/policy.js";
import {
  detectCrossUserRequest,
  sanitizeToolBodyForModel,
} from "../lib/actions/response-sanitize.js";
import { executeHttpAction } from "../lib/actions/http-executor.js";
import { SITE_DEMO_PACK_ID } from "../lib/integrations/site-demo-pack.js";

const HAPY = process.env.TEST_BASE_URL || "http://127.0.0.1:3000";
const PCHAT_ORIGIN = process.env.PCHAT_ORIGIN || "http://localhost:3002";
const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const STATE_FILE = path.join(ROOT, ".pchat-hapy-local.json");
const PCHAT_HTML =
  process.env.PCHAT_INDEX_HTML ||
  "/Users/samiafzal/Desktop/react-firebase-chat/public/index.html";

const passed = [];
const failed = [];

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
    return { _raw: text.slice(0, 300) };
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
async function waitHealth(url, label) {
  const deadline = Date.now() + 60_000;
  let last = "no response";
  while (Date.now() < deadline) {
    try {
      const res = await fetch(url);
      if (res.ok) return await json(res);
      last = `${res.status}`;
    } catch (e) {
      last = e.message;
    }
    await new Promise((r) => setTimeout(r, 500));
  }
  throw new Error(`${label} not ready (${last})`);
}
async function signInHapy(email, password) {
  const jar = cookieJar();
  const csrfRes = await fetch(`${HAPY}/api/auth/csrf`);
  jar.absorb(csrfRes);
  const csrf = await json(csrfRes);
  assert(csrf?.csrfToken, "csrf missing");
  const loginRes = await fetch(`${HAPY}/api/auth/callback/credentials`, {
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
  const sessionRes = await fetch(`${HAPY}/api/auth/session`, {
    headers: { Cookie: jar.header() },
  });
  const session = await json(sessionRes);
  assert(session?.user?.email === email, "session failed");
  return jar;
}
async function hapy(jar, pathName, options = {}) {
  return fetch(`${HAPY}${pathName}`, {
    ...options,
    headers: {
      Cookie: jar.header(),
      ...(options.body ? { "Content-Type": "application/json" } : {}),
      ...(options.headers || {}),
    },
  });
}

function updatePchatEmbed(publicKey) {
  if (!fs.existsSync(PCHAT_HTML)) {
    throw new Error(`missing ${PCHAT_HTML}`);
  }
  let html = fs.readFileSync(PCHAT_HTML, "utf8");
  const snippet = `    <!-- Aide AI — PChat local (Aide :3000 · PChat :3002). setUser wired in src/App.js via Firebase. -->
    <script
      src="http://127.0.0.1:3000/embed.js?v=11"
      data-aide-key="${publicKey}"
      defer
    ></script>
    <script>
      (function () {
        function wire() {
          if (!window.aideChat) return;
          window.aideChat.onAuthRefreshNeeded = function () {
            console.info("[aide] PChat — re-login or App.js will refresh setUser");
          };
        }
        window.addEventListener("load", wire);
        setTimeout(wire, 800);
      })();
    </script>`;

  if (/data-aide-key=/.test(html)) {
    html = html.replace(
      /\s*<!-- Aide[\s\S]*?<\/script>(?:\s*<script>[\s\S]*?<\/script>)?/i,
      `\n${snippet}`
    );
    if (!html.includes(`data-aide-key="${publicKey}"`)) {
      html = html.replace(
        /data-aide-key="[^"]+"/,
        `data-aide-key="${publicKey}"`
      );
      html = html.replace(
        /src="[^"]*embed\.js[^"]*"/,
        `src="http://127.0.0.1:3000/embed.js?v=11"`
      );
    }
  } else {
    html = html.replace("</body>", `${snippet}\n  </body>`);
  }
  fs.writeFileSync(PCHAT_HTML, html);
  return PCHAT_HTML;
}

async function main() {
  console.log("\n=== PChat × Aide local suite ===\n");
  console.log(`Aide  ${HAPY}`);
  console.log(`PChat ${PCHAT_ORIGIN}\n`);

  await test("Aide health", async () => {
    const body = await waitHealth(`${HAPY}/api/health`, "Aide");
    assert(body?.database === "ok", "db");
  });
  await test("PChat up", async () => {
    await waitHealth(PCHAT_ORIGIN, "PChat");
  });

  const stamp = `${Date.now()}-${randomUUID().slice(0, 6)}`;
  const email = `pchat-owner-${stamp}@aide.test`;
  const password = "PChatOwner1!";
  let jar;
  let agent;
  let publicKey;

  await test("Aide register + login", async () => {
    const reg = await fetch(`${HAPY}/api/auth/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: "PChat Agent Owner",
        email,
        password,
        confirmPassword: password,
      }),
    });
    assert(reg.status === 201, `register ${reg.status}`);
    jar = await signInHapy(email, password);
  });

  await test("Create PChat support agent", async () => {
    const res = await hapy(jar, "/api/agents", {
      method: "POST",
      body: JSON.stringify({
        name: "PChat Helper",
        description: "Help for PChat real-time Firebase chat app",
        welcomeMessage:
          "Hi! I help with PChat — rooms, invites, login, and messaging tips.",
        answerStyle: "HYBRID",
        systemPrompt: `You are PChat Helper for the PChat React+Firebase chat app.
Knowledge covers: signup/login, create/join rooms via invite, real-time messages, admin room controls.
Rules:
- Use knowledge for how-to FAQ; use tools for demo catalog/help/ticket when asked for live lookups.
- Embed: every live tool needs Confirm first.
- Guests: public FAQ only. Logged-in (setUser from Firebase uid): may use account tools.
- Refuse cross-user private data ("my friend messages", list all users).`,
      }),
    });
    const body = await json(res);
    assert(res.ok || res.status === 201, `create ${res.status}`);
    agent = body?.agent || body;
    publicKey = agent.publicKey;
    assert(agent?.id && publicKey, "ids");
    return agent.id;
  });

  await test("Customize + origin allowlist :3002", async () => {
    const res = await hapy(jar, `/api/agents/${agent.id}`, {
      method: "PUT",
      body: JSON.stringify({
        actionsEnabled: true,
        customization: {
          identity: {
            displayName: "PChat Helper",
            description: "Rooms · invites · messaging help",
            messagePlaceholder: "How do I join a room?",
            footer: "PChat · powered by Aide",
          },
          appearance: {
            primaryColor: "#8b5cf6",
            theme: "dark",
            font: "dm-sans",
            headerStyle: "primary",
            cornerRadius: 16,
          },
          deploy: {
            chatInterface: "toggle",
            chatLauncher: "bubble",
            widgetPosition: "bottom-right",
            proactiveEnabled: true,
            proactiveMessage: "Need help with rooms or invites?",
          },
          features: {
            messageFeedback: true,
            conversationHistory: true,
            historyReset: "7d",
            allowedOriginsMode: "allowlist",
            allowedOrigins:
              "http://localhost:3002\nhttp://127.0.0.1:3002",
          },
        },
      }),
    });
    assert(res.ok, `update ${res.status}`);
  });

  await test("Add PChat FAQ knowledge", async () => {
    const faqs = [
      {
        name: "What is PChat",
        content:
          "PChat is a real-time chat app built with React and Firebase Auth + Firestore. Users sign up, create or join rooms, and message instantly.",
      },
      {
        name: "How to join a room",
        content:
          "Open an invite link /chat/join/CODE while logged in, or paste the invite code. You must be authenticated to join.",
      },
      {
        name: "Create a room",
        content:
          "After login, create a room from the chat UI. You become the room admin and can invite others with a shareable code.",
      },
      {
        name: "Login and signup",
        content:
          "Use email/password or Google on /login and /signup. Protected routes redirect guests to /home.",
      },
      {
        name: "Privacy in rooms",
        content:
          "Only room members see messages. Admins can remove members. Never share another user’s private chats.",
      },
    ];
    for (const faq of faqs) {
      const res = await hapy(jar, `/api/agents/${agent.id}/knowledge`, {
        method: "POST",
        body: JSON.stringify({
          type: "TEXT",
          name: faq.name,
          content: faq.content,
        }),
      });
      assert(
        res.ok || res.status === 201,
        `knowledge ${faq.name} ${res.status}`
      );
    }
    return `${faqs.length} TEXT`;
  });

  await test("Install site_demo_v1 tools", async () => {
    const res = await hapy(jar, `/api/agents/${agent.id}/action-packs`, {
      method: "POST",
      body: JSON.stringify({ packId: SITE_DEMO_PACK_ID }),
    });
    const body = await json(res);
    assert(res.ok || res.status === 201, `pack ${res.status}`);
    assert((body?.created || []).length >= 1, "none created");
    return `${(body.created || []).length} tools`;
  });

  await test("Patch tools access classes", async () => {
    const listRes = await hapy(jar, `/api/agents/${agent.id}/actions`);
    const actions = (await json(listRes))?.actions || [];
    for (const action of actions) {
      const isWrite = /ticket|lead|preference|create|update/i.test(
        action.name || ""
      );
      const patch = await hapy(
        jar,
        `/api/agents/${agent.id}/actions/${action.id}`,
        {
          method: "PATCH",
          body: JSON.stringify({
            accessClass: isWrite ? "ACCOUNT_WRITE" : "PUBLIC_READ",
            requiresConfirmation: true,
            identityMode: isWrite ? "END_USER_TOKEN" : "OWNER_KEY",
            requiresIdentity: isWrite,
            riskLevel: isWrite ? "WRITE" : "READ",
          }),
        }
      );
      assert(patch.ok, `patch ${action.name}`);
    }
    return `${actions.length}`;
  });

  await test("Embed index.html + App.js setUser", async () => {
    updatePchatEmbed(publicKey);
    const html = fs.readFileSync(PCHAT_HTML, "utf8");
    assert(html.includes(publicKey), "key");
    assert(/embed\.js\?v=11/.test(html), "v=11");
    const appJs = fs.readFileSync(
      "/Users/samiafzal/Desktop/react-firebase-chat/src/App.js",
      "utf8"
    );
    assert(/hapyChat\.setUser/.test(appJs), "App.js setUser");
    return publicKey;
  });

  // Edges
  await test("Edge: demo help tool HTTP", async () => {
    const result = await executeHttpAction({
      method: "GET",
      urlTemplate: `${HAPY}/api/demo/help?q={{query}}`,
      args: { query: "password" },
      allowLocalDemo: true,
      frozenHost: "127.0.0.1",
      riskLevel: "READ",
    });
    assert(result.ok, result.errorCode);
  });

  await test("Edge: guest Confirm required", async () => {
    const p = evaluateActionPolicy({
      action: { riskLevel: "READ", identityMode: "OWNER_KEY" },
      publicAccess: true,
    });
    assert(p.code === "CONFIRMATION_REQUIRED", p.code);
  });

  await test("Edge: logged-in WRITE needs identity", async () => {
    const p = evaluateActionPolicy({
      action: {
        riskLevel: "WRITE",
        identityMode: "END_USER_TOKEN",
        requiresIdentity: true,
        requiresConfirmation: true,
      },
      publicAccess: true,
      confirmationStatus: "APPROVED",
    });
    assert(
      p.code === "IDENTITY_REQUIRED" || p.code === "END_USER_TOKEN_REQUIRED",
      p.code
    );
  });

  await test("Edge: logged-in WRITE allowed with subject+token+confirm", async () => {
    const p = evaluateActionPolicy({
      action: {
        riskLevel: "WRITE",
        identityMode: "END_USER_TOKEN",
        requiresIdentity: true,
        requiresConfirmation: true,
      },
      publicAccess: true,
      confirmationStatus: "APPROVED",
      customerSubject: "firebase_uid_1",
      endUserAccessToken: "firebase_id_token",
    });
    assert(p.allow === true, JSON.stringify(p));
  });

  await test("Edge: CROSS_USER denied", async () => {
    assert(
      detectCrossUserRequest("read my friend private messages", null, "u1") ===
        true
    );
    const p = evaluateActionPolicy({
      action: { riskLevel: "READ" },
      publicAccess: true,
      lastUserMessage: "list all users in every room",
      customerSubject: "u1",
    });
    assert(p.code === "CROSS_USER_DENIED", p.code);
  });

  await test("Edge: guest PII sanitize", async () => {
    const out = sanitizeToolBodyForModel(
      JSON.stringify({ tip: "ok", email: "a@b.com", phone: "03001234567" }),
      { guest: true }
    );
    assert(!out.includes("a@b.com"), "email");
  });

  await test("Edge: studio FAQ (join room)", async () => {
    const res = await hapy(jar, `/api/agents/${agent.id}/chat`, {
      method: "POST",
      body: JSON.stringify({
        message: "How do I join a room with an invite code?",
      }),
    });
    const body = await json(res);
    assert(res.ok, `chat ${res.status}`);
    const reply = String(
      body?.reply || body?.message?.content || body?.assistantMessage || ""
    );
    assert(reply.length > 20, "empty");
    assert(/join|invite|login|authenticated|room/i.test(reply), "off topic");
    return reply.slice(0, 80);
  });

  await test("Edge: knowledge retrieve BrandIN-like phrase", async () => {
    // Lexical KB (F08) — must ground on PChat FAQ
    const res = await hapy(jar, `/api/agents/${agent.id}/chat`, {
      method: "POST",
      body: JSON.stringify({ message: "What is PChat built with?" }),
    });
    const body = await json(res);
    assert(res.ok, `kb ${res.status}`);
    const reply = String(
      body?.reply || body?.message?.content || body?.assistantMessage || ""
    );
    assert(/Firebase|React|Firestore|Auth/i.test(reply), "KB miss");
  });

  await test("Edge: public guest chat", async () => {
    const res = await fetch(`${HAPY}/api/public/agents/${publicKey}/chat`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Origin: PCHAT_ORIGIN,
      },
      body: JSON.stringify({ message: "How do I sign up for PChat?" }),
    });
    const body = await json(res);
    assert(res.ok, `pub ${res.status} ${JSON.stringify(body).slice(0, 160)}`);
  });

  await test("Edge: public logged-in session chat", async () => {
    const res = await fetch(`${HAPY}/api/public/agents/${publicKey}/chat`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Origin: PCHAT_ORIGIN,
      },
      body: JSON.stringify({
        message: "I am logged in — remind me how room admins work",
        userSession: {
          subject: "pchat_test_uid_1",
          displayName: "Test Chatter",
          accessToken: "opaque_host_token_for_test",
        },
      }),
    });
    const body = await json(res);
    assert(res.ok, `logged ${res.status} ${JSON.stringify(body).slice(0, 160)}`);
  });

  await test("Edge: public ping origin", async () => {
    const res = await fetch(`${HAPY}/api/public/agents/${publicKey}/ping`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Origin: PCHAT_ORIGIN,
      },
      body: JSON.stringify({}),
    });
    assert(res.ok || res.status === 403, `ping ${res.status}`);
    return `HTTP ${res.status}`;
  });

  await test("Edge: action test search_help", async () => {
    const listRes = await hapy(jar, `/api/agents/${agent.id}/actions`);
    const actions = (await json(listRes))?.actions || [];
    const help = actions.find((a) => a.name === "search_help");
    assert(help, "search_help");
    const res = await hapy(
      jar,
      `/api/agents/${agent.id}/actions/${help.id}/test`,
      {
        method: "POST",
        body: JSON.stringify({ args: { query: "password" } }),
      }
    );
    assert(res.ok, `test ${res.status}`);
  });

  const state = {
    updatedAt: new Date().toISOString(),
    hapyEmail: email,
    agentId: agent.id,
    publicKey,
    origin: PCHAT_ORIGIN,
    pchatHtml: PCHAT_HTML,
  };
  fs.writeFileSync(STATE_FILE, JSON.stringify(state, null, 2));

  console.log("\n--- summary ---");
  console.log(`passed ${passed.length}  failed ${failed.length}`);
  console.log(`agent ${agent.id}`);
  console.log(`key   ${publicKey}`);
  console.log(`open  ${PCHAT_ORIGIN}\n`);
  if (failed.length) {
    for (const f of failed) console.error(`  • ${f.name}: ${f.detail}`);
    process.exit(1);
  }
}

main().catch((e) => {
  console.error("FATAL", e.message);
  process.exit(1);
});
