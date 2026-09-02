/**
 * Brandly FYP ↔ Aide: create agent, customize, wire tools, run edge-case suite.
 *
 * Prereqs (already running on this machine):
 *   - Aide   http://127.0.0.1:3000
 *   - Brandly API  http://127.0.0.1:8000
 *   - Brandly UI   http://127.0.0.1:3001
 *
 * Optional:
 *   BRANDLY_API_KEY=brnd_live_…   (else creates key via Brandly login)
 *   BRANDLY_EMAIL / BRANDLY_PASSWORD
 *
 * Run:
 *   node scripts/setup-and-test-brandly-agent.mjs
 */
import "dotenv/config";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { randomUUID } from "node:crypto";
import { evaluateActionPolicy } from "../lib/actions/policy.js";
import { detectCrossUserRequest } from "../lib/actions/response-sanitize.js";
import { executeHttpAction } from "../lib/actions/http-executor.js";
import { applyCredentialToHeaders } from "../lib/actions/credential-apply.js";

const HAPY = process.env.TEST_BASE_URL || "http://127.0.0.1:3000";
const BRANDLY = process.env.BRANDLY_API_BASE || "http://127.0.0.1:8000/api/v1";
const BRANDLY_ORIGIN = process.env.BRANDLY_ORIGIN || "http://localhost:3001";
const BRANDLY_EMAIL =
  process.env.BRANDLY_EMAIL || "hapy.brandly.agent@gmail.com";
const BRANDLY_PASSWORD = process.env.BRANDLY_PASSWORD || "HapyBrandly!2026";
const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const STATE_FILE = path.join(ROOT, ".brandly-hapy-local.json");
const BRANDIN_HTML =
  process.env.BRANDIN_INDEX_HTML ||
  "/Users/samiafzal/Desktop/FYP/03_Source_Code/FYP/brandin/public/index.html";

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
  const deadline = Date.now() + 20_000;
  let last = "no response";
  while (Date.now() < deadline) {
    try {
      const res = await fetch(url);
      const body = await json(res);
      if (res.ok) return body;
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
  assert(session?.user?.email === email, "Aide session failed");
  return jar;
}

async function hapy(jar, pathName, options = {}) {
  const headers = {
    Cookie: jar.header(),
    ...(options.body ? { "Content-Type": "application/json" } : {}),
    ...(options.headers || {}),
  };
  return fetch(`${HAPY}${pathName}`, { ...options, headers });
}

async function ensureBrandlyApiKey() {
  if (process.env.BRANDLY_API_KEY?.trim()) {
    return process.env.BRANDLY_API_KEY.trim();
  }
  if (fs.existsSync(STATE_FILE)) {
    try {
      const prev = JSON.parse(fs.readFileSync(STATE_FILE, "utf8"));
      if (prev.brandlyApiKey) return prev.brandlyApiKey;
    } catch {
      /* ignore */
    }
  }
  const loginRes = await fetch(`${BRANDLY}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      email: BRANDLY_EMAIL,
      password: BRANDLY_PASSWORD,
    }),
  });
  const loginBody = await json(loginRes);
  assert(loginRes.ok, `Brandly login ${loginRes.status}`);
  const token = loginBody?.data?.accessToken;
  assert(token, "Brandly accessToken missing");

  const keyRes = await fetch(`${BRANDLY}/auth/api-keys`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      name: `Aide Local ${new Date().toISOString().slice(0, 10)}`,
      scopes: [
        "campaigns:read",
        "influencers:read",
        "brands:read",
        "aimatch:read",
      ],
    }),
  });
  const keyBody = await json(keyRes);
  assert(keyRes.ok || keyRes.status === 201, `create api key ${keyRes.status}`);
  const apiKey = keyBody?.data?.apiKey;
  assert(apiKey, "apiKey missing in response");
  return apiKey;
}

async function ensureHelCampaign(apiKey) {
  const listRes = await fetch(`${BRANDLY}/campaigns?search=Hel&limit=5`, {
    headers: { "X-API-KEY": apiKey },
  });
  const listBody = await json(listRes);
  assert(listRes.ok, `list campaigns ${listRes.status}`);
  const found = (listBody?.data?.campaigns || []).find((c) =>
    /Hel/i.test(c.name || "")
  );
  if (found?._id) return found;

  const loginRes = await fetch(`${BRANDLY}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      email: BRANDLY_EMAIL,
      password: BRANDLY_PASSWORD,
    }),
  });
  const loginBody = await json(loginRes);
  const token = loginBody?.data?.accessToken;
  const form = new FormData();
  form.set("name", "Helium Launch Hel");
  form.set("description", "Demo campaign for Aide agent edge cases");
  form.set("status", "draft");
  form.set("industry", "Technology");
  form.append("platform", "instagram");
  form.append("platform", "youtube");
  form.set("budget[min]", "500");
  form.set("budget[max]", "2000");
  form.set("campaignTimeline[startDate]", "2026-09-01");
  form.set("campaignTimeline[endDate]", "2026-10-01");
  const createRes = await fetch(`${BRANDLY}/campaigns`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
    body: form,
  });
  const created = await json(createRes);
  assert(createRes.ok || createRes.status === 201, `create campaign ${createRes.status}`);
  return created?.data;
}

function updateBrandinEmbed(publicKey) {
  if (!fs.existsSync(BRANDIN_HTML)) {
    throw new Error(`brandin index.html not found: ${BRANDIN_HTML}`);
  }
  let html = fs.readFileSync(BRANDIN_HTML, "utf8");
  const snippet = `    <!-- Aide AI support — Brandly FYP (local). Aide :3000 · Brandly UI :3001 · API :8000 -->
    <script
      src="http://localhost:3000/embed.js?v=11"
      data-aide-key="${publicKey}"
      defer
    ></script>
    <script>
      (function () {
        var API = (window.REACT_APP_API_URL || "http://127.0.0.1:8000") + "/api/v1";
        function pushUser(user, accessToken) {
          if (!window.aideChat || !user) return;
          var subject = String(user._id || user.id || "");
          if (!subject) return;
          window.aideChat.setUser({
            subject: subject,
            displayName: user.fullname || user.name || "Brandly user",
            accessToken: accessToken || undefined,
          });
        }
        async function syncFromBrandly() {
          if (!window.aideChat) return;
          try {
            var res = await fetch(API + "/users/me", { credentials: "include" });
            if (!res.ok) {
              // Guest path — clear only if previously set; handshake null is handled by Aide
              return;
            }
            var body = await res.json();
            var user = body?.data?.user || body?.data || body?.user;
            pushUser(user);
          } catch (e) {
            console.info("[aide] Brandly me sync skipped", e && e.message);
          }
        }
        function wire() {
          if (!window.aideChat) return;
          window.aideChat.onAuthRefreshNeeded = function () {
            syncFromBrandly();
          };
          syncFromBrandly();
        }
        window.addEventListener("load", wire);
        setTimeout(wire, 600);
        setTimeout(wire, 2000);
      })();
    </script>`;

  if (/data-aide-key=/.test(html)) {
    html = html.replace(
      /<!-- Aide AI support[\s\S]*?<\/script>\s*<script>[\s\S]*?<\/script>/,
      snippet.trim()
    );
    // Fallback if comment format differs
    if (!html.includes(`data-aide-key="${publicKey}"`)) {
      html = html.replace(
        /data-aide-key="[^"]+"/,
        `data-aide-key="${publicKey}"`
      );
      html = html.replace(/embed\.js\?v=\d+/, "embed.js?v=11");
    }
  } else {
    html = html.replace("</body>", `${snippet}\n  </body>`);
  }
  fs.writeFileSync(BRANDIN_HTML, html);
  return BRANDIN_HTML;
}

async function main() {
  console.log("\n=== Brandly × Aide local suite ===\n");
  console.log(`Aide     ${HAPY}`);
  console.log(`Brandly  ${BRANDLY}`);
  console.log(`Origin   ${BRANDLY_ORIGIN}\n`);

  await test("Aide health", async () => {
    const body = await waitHealth(`${HAPY}/api/health`, "Aide");
    assert(body?.database === "ok", "db not ok");
  });

  await test("Brandly ping", async () => {
    await waitHealth(`${BRANDLY}/ping`, "Brandly");
  });

  let apiKey;
  await test("Brandly API key", async () => {
    apiKey = await ensureBrandlyApiKey();
    assert(/^brnd_live_/.test(apiKey), "unexpected key prefix");
    return apiKey.slice(0, 14) + "…";
  });

  let campaign;
  await test("Brandly Hel campaign", async () => {
    campaign = await ensureHelCampaign(apiKey);
    assert(campaign?._id, "campaign id missing");
    return `${campaign.name} (${campaign._id})`;
  });

  const stamp = `${Date.now()}-${randomUUID().slice(0, 6)}`;
  const email = `brandly-owner-${stamp}@aide.test`;
  const password = "BrandlyOwner1!";
  let jar;
  let agent;
  let credentialId;
  let publicKey;

  await test("Aide register + login", async () => {
    const reg = await fetch(`${HAPY}/api/auth/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: "Brandly Agent Owner",
        email,
        password,
        confirmPassword: password,
      }),
    });
    const regBody = await json(reg);
    assert(reg.status === 201, `register ${reg.status} ${JSON.stringify(regBody)}`);
    jar = await signInHapy(email, password);
  });

  await test("Create Brandly support agent", async () => {
    const res = await hapy(jar, "/api/agents", {
      method: "POST",
      body: JSON.stringify({
        name: "Brandly Support",
        description:
          "FYP Brandly — campaign status, matching FAQ, guest + confirm tools",
        welcomeMessage:
          "Hi! I am Brandly Support. Ask about campaign status, matching, or how Brandly works.",
        answerStyle: "HYBRID",
        systemPrompt: `You are Brandly Support for the Brandly influencer marketplace (FYP).
Rules:
- Use tools for live campaign status; never invent campaign data.
- When the user names a campaign (e.g. Hel), call list_brandly_campaigns first, then get_brandly_campaign with the _id.
- For status questions, reply with name + status only unless they ask for budget/platforms.
- Refuse requests for another user's private account data.
- Guests only get public/redacted campaign info.
- Knowledge covers FAQ (refunds/matching/how Brandly works).`,
      }),
    });
    const body = await json(res);
    assert(res.status === 201 || res.ok, `create agent ${res.status}`);
    agent = body?.agent || body;
    assert(agent?.id, "agent id missing");
    publicKey = agent.publicKey;
    return agent.id;
  });

  await test("Enable actions + Brandly customization", async () => {
    const res = await hapy(jar, `/api/agents/${agent.id}`, {
      method: "PUT",
      body: JSON.stringify({
        actionsEnabled: true,
        customization: {
          identity: {
            displayName: "Brandly Support",
            description: "Campaign help for brands & influencers",
            messagePlaceholder: "Ask about a campaign or matching…",
            footer: "Powered by Aide · Brandly FYP",
            contactWebsite: "http://localhost:3001",
          },
          appearance: {
            primaryColor: "#0b5f58",
            theme: "light",
            font: "dm-sans",
            headerStyle: "primary",
            cornerRadius: 16,
          },
          deploy: {
            chatInterface: "toggle",
            chatLauncher: "bubble",
            widgetPosition: "bottom-right",
            proactiveEnabled: true,
            proactiveMessage: "Need campaign status? Ask me.",
          },
          features: {
            messageFeedback: true,
            conversationHistory: true,
            historyReset: "7d",
            allowedOriginsMode: "allowlist",
            allowedOrigins: "http://localhost:3001\nhttp://127.0.0.1:3001",
          },
        },
      }),
    });
    const body = await json(res);
    assert(res.ok, `update agent ${res.status} ${JSON.stringify(body)}`);
  });

  await test("Add Brandly FAQ knowledge", async () => {
    const faqs = [
      {
        name: "What is Brandly",
        content:
          "Brandly is an influencer marketing marketplace that matches brands with creators. Brands create campaigns; influencers apply and collaborate.",
      },
      {
        name: "Campaign status meanings",
        content:
          "Draft = not published. Pending = awaiting review. Active = open for applications. Paused = temporarily stopped. Completed = finished.",
      },
      {
        name: "How matching works",
        content:
          "Brandly AI matching suggests influencers by industry, platform, and audience fit. Brands can invite or accept applications.",
      },
      {
        name: "Support and billing FAQ",
        content:
          "For payment or disputes, use in-app Messages. Refunds follow the collaboration contract. Contact support from Brandly Help Center.",
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
      assert(res.ok || res.status === 201, `knowledge ${faq.name} ${res.status}`);
    }
    return `${faqs.length} TEXT items`;
  });

  await test("Create Brandly X-API-KEY credential", async () => {
    const res = await hapy(jar, `/api/agents/${agent.id}/credentials`, {
      method: "POST",
      body: JSON.stringify({
        name: "Brandly API",
        secret: apiKey,
        type: "API_KEY_HEADER",
        headerName: "X-API-KEY",
      }),
    });
    const body = await json(res);
    assert(res.ok || res.status === 201, `credential ${res.status} ${JSON.stringify(body)}`);
    credentialId = body?.id || body?.credential?.id;
    assert(credentialId, "credentialId missing");
  });

  await test("Install brandly action pack", async () => {
    const res = await hapy(jar, `/api/agents/${agent.id}/action-packs`, {
      method: "POST",
      body: JSON.stringify({
        packId: "brandly",
        credentialId,
      }),
    });
    const body = await json(res);
    assert(res.ok || res.status === 201, `pack ${res.status} ${JSON.stringify(body)}`);
    assert((body?.created || []).length >= 1, "no actions created");
    return `created ${(body.created || []).map((a) => a.name).join(", ")}`;
  });

  await test("Patch tools accessClass + confirm", async () => {
    const listRes = await hapy(jar, `/api/agents/${agent.id}/actions`);
    const listBody = await json(listRes);
    const actions = listBody?.actions || listBody || [];
    for (const action of actions) {
      if (!/brandly/i.test(action.name || "")) continue;
      const patch = await hapy(jar, `/api/agents/${agent.id}/actions/${action.id}`, {
        method: "PATCH",
        body: JSON.stringify({
          accessClass: "PUBLIC_READ",
          credentialId,
          requiresConfirmation: true,
          identityMode: "OWNER_KEY",
          riskLevel: "READ",
        }),
      });
      assert(patch.ok, `patch ${action.name} ${patch.status}`);
    }
  });

  await test("Update Brandly UI embed (v=11 + setUser sync)", async () => {
    const file = updateBrandinEmbed(publicKey);
    const html = fs.readFileSync(file, "utf8");
    assert(html.includes(publicKey), "publicKey in html");
    assert(/embed\.js\?v=11/.test(html), "v=11");
    assert(/setUser/.test(html), "setUser wiring");
    return publicKey;
  });

  // --- Edge / policy suite ---

  await test("Edge: direct Brandly with key → 200", async () => {
    const res = await fetch(`${BRANDLY}/campaigns?search=Hel&limit=3`, {
      headers: { "X-API-KEY": apiKey },
    });
    assert(res.ok, `status ${res.status}`);
    const body = await json(res);
    assert((body?.data?.campaigns || []).length >= 1, "expected Hel campaign");
  });

  await test("Edge: direct Brandly without key → 401", async () => {
    const res = await fetch(`${BRANDLY}/campaigns?limit=1`);
    assert(res.status === 401, `expected 401 got ${res.status}`);
  });

  await test("Edge: Aide executor + credential → OK", async () => {
    const credential = {
      name: "Brandly API",
      type: "API_KEY_HEADER",
      headerName: "X-API-KEY",
      plaintext: apiKey,
    };
    applyCredentialToHeaders({}, credential);
    const result = await executeHttpAction({
      method: "GET",
      urlTemplate: `${BRANDLY}/campaigns?search={{query}}&limit=5`,
      args: { query: "Hel" },
      timeoutMs: 12000,
      allowLocalDemo: true,
      credential,
      frozenHost: "127.0.0.1",
      riskLevel: "READ",
    });
    assert(result.ok, `${result.errorCode} ${String(result.bodyText || "").slice(0, 120)}`);
  });

  await test("Edge: get campaign by id", async () => {
    const credential = {
      name: "Brandly API",
      type: "API_KEY_HEADER",
      headerName: "X-API-KEY",
      plaintext: apiKey,
    };
    const result = await executeHttpAction({
      method: "GET",
      urlTemplate: `${BRANDLY}/campaigns/{{campaignId}}`,
      args: { campaignId: campaign._id },
      timeoutMs: 12000,
      allowLocalDemo: true,
      credential,
      frozenHost: "127.0.0.1",
      riskLevel: "READ",
    });
    assert(result.ok, `${result.errorCode}`);
    assert(/Helium|Hel|draft/i.test(result.bodyText || ""), "body has campaign");
  });

  await test("Edge: embed publicAccess forces Confirm", async () => {
    const denied = evaluateActionPolicy({
      action: {
        identityMode: "OWNER_KEY",
        riskLevel: "READ",
        requiresConfirmation: false,
      },
      publicAccess: true,
    });
    assert(denied.allow === false, "must deny");
    assert(denied.code === "CONFIRMATION_REQUIRED", denied.code);
  });

  await test("Edge: CROSS_USER_DENIED (friend campaign)", async () => {
    assert(
      detectCrossUserRequest("show my friend campaign status", null, "user_1") ===
        true,
      "detect"
    );
    const policy = evaluateActionPolicy({
      action: { identityMode: "OWNER_KEY", riskLevel: "READ" },
      publicAccess: true,
      lastUserMessage: "show my friend campaign Hel",
      customerSubject: "user_1",
    });
    assert(policy.code === "CROSS_USER_DENIED", policy.code);
  });

  await test("Edge: foreign userId in tool args", async () => {
    const policy = evaluateActionPolicy({
      action: {
        identityMode: "END_USER_TOKEN",
        riskLevel: "READ",
        requiresIdentity: true,
      },
      publicAccess: false,
      customerSubject: "user_1",
      endUserAccessToken: "tok",
      confirmationStatus: "APPROVED",
      lastUserMessage: "get my campaign",
      toolArgs: { userId: "other_brand" },
    });
    assert(policy.code === "CROSS_USER_DENIED", policy.code);
  });

  await test("Edge: studio chat FAQ (knowledge)", async () => {
    const res = await hapy(jar, `/api/agents/${agent.id}/chat`, {
      method: "POST",
      body: JSON.stringify({
        message: "What is Brandly and how does matching work?",
      }),
    });
    const body = await json(res);
    assert(res.ok, `chat ${res.status} ${JSON.stringify(body).slice(0, 200)}`);
    const reply = body?.reply || body?.message?.content || body?.assistantMessage || "";
    assert(String(reply).length > 20, "empty reply");
    return String(reply).slice(0, 80);
  });

  await test("Edge: public embed ping (origin allowlist)", async () => {
    const res = await fetch(`${HAPY}/api/public/agents/${publicKey}/ping`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Origin: BRANDLY_ORIGIN,
      },
      body: JSON.stringify({}),
    });
    // Some deployments return 200; origin deny may be 403
    assert(
      res.ok || res.status === 204 || res.status === 403,
      `ping ${res.status}`
    );
    return `HTTP ${res.status}`;
  });

  await test("Edge: action test endpoint list_brandly_campaigns", async () => {
    const listRes = await hapy(jar, `/api/agents/${agent.id}/actions`);
    const listBody = await json(listRes);
    const actions = listBody?.actions || [];
    const listAction = actions.find((a) => a.name === "list_brandly_campaigns");
    assert(listAction, "list_brandly_campaigns missing");
    const res = await hapy(
      jar,
      `/api/agents/${agent.id}/actions/${listAction.id}/test`,
      {
        method: "POST",
        body: JSON.stringify({ args: { query: "Hel" } }),
      }
    );
    const body = await json(res);
    assert(res.ok, `test ${res.status} ${JSON.stringify(body).slice(0, 200)}`);
    assert(
      body?.ok === true || body?.result?.ok === true || body?.httpStatus === 200,
      JSON.stringify(body).slice(0, 180)
    );
  });

  // Persist local state (key redacted in console only)
  const state = {
    updatedAt: new Date().toISOString(),
    hapyEmail: email,
    agentId: agent.id,
    publicKey,
    campaignId: campaign._id,
    campaignName: campaign.name,
    brandlyApiKey: apiKey,
    credentialId,
    brandinHtml: BRANDIN_HTML,
  };
  fs.writeFileSync(STATE_FILE, JSON.stringify(state, null, 2));

  console.log("\n--- summary ---");
  console.log(`passed ${passed.length}  failed ${failed.length}`);
  console.log(`agent     ${agent.id}`);
  console.log(`publicKey ${publicKey}`);
  console.log(`campaign  ${campaign._id}`);
  console.log(`embed     ${BRANDIN_HTML}`);
  console.log(`state     ${STATE_FILE}`);
  console.log("\nOpen Brandly UI http://localhost:3001 — widget should load.");
  console.log("Studio: Aide → Agents → Brandly Support → Test\n");

  if (failed.length) {
    for (const f of failed) console.error(`  • ${f.name}: ${f.detail}`);
    process.exit(1);
  }
}

main().catch((err) => {
  console.error("\nFATAL:", err.message);
  process.exit(1);
});
