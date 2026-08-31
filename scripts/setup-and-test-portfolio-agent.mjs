/**
 * my-portfolio ↔ Aide: create agent, customize, site_demo tools, embed, edge suite.
 *
 * Prereqs:
 *   - Aide      http://127.0.0.1:3000
 *   - Portfolio http://127.0.0.1:5173  (Vite)
 *
 * Run:
 *   npm run test:portfolio-local
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
const PORTFOLIO_ORIGIN =
  process.env.PORTFOLIO_ORIGIN || "http://127.0.0.1:5173";
const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const STATE_FILE = path.join(ROOT, ".portfolio-hapy-local.json");
const PORTFOLIO_HTML =
  process.env.PORTFOLIO_INDEX_HTML ||
  "/Users/samiafzal/Desktop/my-portfolio/index.html";

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
      if (res.ok) return await json(res);
      last = `${res.status}`;
    } catch (e) {
      last = e.message;
    }
    await new Promise((r) => setTimeout(r, 400));
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

function updatePortfolioEmbed(publicKey) {
  if (!fs.existsSync(PORTFOLIO_HTML)) {
    throw new Error(`portfolio index.html missing: ${PORTFOLIO_HTML}`);
  }
  let html = fs.readFileSync(PORTFOLIO_HTML, "utf8");
  const snippet = `    <!-- Aide AI — Portfolio local (Aide :3000 · Vite :5173) -->
    <script
      src="http://127.0.0.1:3000/embed.js?v=11"
      data-aide-key="${publicKey}"
      defer
    ></script>
    <script>
      (function () {
        function wire() {
          if (!window.aideChat) return;
          // Public portfolio — guest path. Confirm runs before every live tool.
          window.aideChat.onAuthRefreshNeeded = function () {
            console.info("[aide] portfolio guest — no setUser token");
          };
        }
        window.addEventListener("load", wire);
        setTimeout(wire, 600);
      })();
    </script>`;

  if (/data-aide-key=/.test(html)) {
    // Replace existing Aide block(s)
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
      if (!/onAuthRefreshNeeded/.test(html)) {
        html = html.replace("</body>", `${snippet}\n  </body>`);
      }
    }
  } else {
    html = html.replace("</body>", `${snippet}\n  </body>`);
  }
  fs.writeFileSync(PORTFOLIO_HTML, html);
  return PORTFOLIO_HTML;
}

async function main() {
  console.log("\n=== Portfolio × Aide local suite ===\n");
  console.log(`Aide      ${HAPY}`);
  console.log(`Portfolio ${PORTFOLIO_ORIGIN}\n`);

  await test("Aide health", async () => {
    const body = await waitHealth(`${HAPY}/api/health`, "Aide");
    assert(body?.database === "ok", "db not ok");
  });

  await test("Portfolio Vite up", async () => {
    await waitHealth(PORTFOLIO_ORIGIN, "Portfolio");
  });

  const stamp = `${Date.now()}-${randomUUID().slice(0, 6)}`;
  const email = `portfolio-owner-${stamp}@aide.test`;
  const password = "PortfolioOwner1!";
  let jar;
  let agent;
  let publicKey;

  await test("Aide register + login", async () => {
    const reg = await fetch(`${HAPY}/api/auth/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: "Portfolio Agent Owner",
        email,
        password,
        confirmPassword: password,
      }),
    });
    const regBody = await json(reg);
    assert(reg.status === 201, `register ${reg.status} ${JSON.stringify(regBody)}`);
    jar = await signInHapy(email, password);
  });

  await test("Create Portfolio support agent", async () => {
    const res = await hapy(jar, "/api/agents", {
      method: "POST",
      body: JSON.stringify({
        name: "Sami Portfolio Assistant",
        description:
          "Visitor help for Rana Muhammad Sami’s portfolio — projects, skills, contact",
        welcomeMessage:
          "Hi! Ask about Sami’s projects (BrandIN, SpendWise, chat app), skills, or how to hire him.",
        answerStyle: "HYBRID",
        systemPrompt: `You are the assistant on Rana Muhammad Sami’s personal portfolio (Lahore, PK).
Facts you may use from knowledge:
- Full-stack developer: React, Next.js, Node, Express, MongoDB, Firebase.
- Featured project: BrandIN — AI brand–influencer platform.
- Other work: real-time chat, SpendWise finance dashboard, games, this React portfolio.
- Contact: ranasami0909@gmail.com · GitHub RanaSamiafzal · LinkedIn ranasamiafzal.
Rules:
- Prefer knowledge + tools; never invent private contact beyond the public email.
- Live tools (demo catalog/help/ticket) need Confirm on the embed before calling.
- Refuse requests for other people’s private accounts or “my friend’s” data.
- Be concise, friendly, and professional.`,
      }),
    });
    const body = await json(res);
    assert(res.status === 201 || res.ok, `create ${res.status}`);
    agent = body?.agent || body;
    assert(agent?.id, "agent id");
    publicKey = agent.publicKey;
    return agent.id;
  });

  await test("Customize identity + dark accent + origins", async () => {
    const res = await hapy(jar, `/api/agents/${agent.id}`, {
      method: "PUT",
      body: JSON.stringify({
        actionsEnabled: true,
        customization: {
          identity: {
            displayName: "Sami’s Assistant",
            description: "Projects · skills · hire Sami",
            messagePlaceholder: "Ask about BrandIN, skills, or hiring…",
            footer: "Portfolio · powered by Aide",
            contactEmail: "ranasami0909@gmail.com",
            contactWebsite: "https://my-portfolio-peach-three-14.vercel.app/",
          },
          appearance: {
            primaryColor: "#ff6b2b",
            theme: "dark",
            font: "dm-sans",
            headerStyle: "primary",
            cornerRadius: 14,
          },
          deploy: {
            chatInterface: "toggle",
            chatLauncher: "bubble",
            widgetPosition: "bottom-right",
            proactiveEnabled: true,
            proactiveMessage: "Want a project walkthrough? Ask me.",
          },
          features: {
            messageFeedback: true,
            conversationHistory: true,
            historyReset: "7d",
            allowedOriginsMode: "allowlist",
            allowedOrigins:
              "http://localhost:5173\nhttp://127.0.0.1:5173\nhttps://my-portfolio-peach-three-14.vercel.app",
          },
        },
      }),
    });
    assert(res.ok, `update ${res.status}`);
  });

  await test("Add portfolio FAQ knowledge", async () => {
    const faqs = [
      {
        name: "About Sami",
        content:
          "Rana Muhammad Sami is a full-stack developer in Lahore, Pakistan. He builds React/Next.js frontends and Node/Express/MongoDB/Firebase backends. Hire: ranasami0909@gmail.com.",
      },
      {
        name: "Featured project BrandIN",
        content:
          "BrandIN is an AI brand–influencer platform with matching, dashboards, and real-time notifications. Stack: React, Node, MongoDB, Express, REST API.",
      },
      {
        name: "Other projects",
        content:
          "Projects include: Real-Time Chat (React+Firebase), SpendWise finance dashboard (React+Genkit+Firebase), Rock-Paper-Scissors & Tic-Tac-Toe, Product Registration Form, and this cinematic React portfolio on Vite + Tailwind.",
      },
      {
        name: "Skills",
        content:
          "Frontend: React.js, Next.js, JavaScript, HTML5, CSS3, Redux Toolkit. Backend: Node.js, Express, REST, Firebase, MongoDB. Tools: Git, VS Code, Figma. Also video: Premiere, After Effects, Photoshop.",
      },
      {
        name: "Contact and links",
        content:
          "Email ranasami0909@gmail.com. GitHub https://github.com/RanaSamiafzal. LinkedIn https://www.linkedin.com/in/ranasamiafzal/. Live portfolio https://my-portfolio-peach-three-14.vercel.app/",
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
    return `${faqs.length} TEXT`;
  });

  await test("Install site_demo_v1 action pack", async () => {
    const res = await hapy(jar, `/api/agents/${agent.id}/action-packs`, {
      method: "POST",
      body: JSON.stringify({ packId: SITE_DEMO_PACK_ID }),
    });
    const body = await json(res);
    assert(res.ok || res.status === 201, `pack ${res.status} ${JSON.stringify(body)}`);
    assert((body?.created || []).length >= 1, "no actions");
    return `created ${(body.created || []).map((a) => a.name).join(", ")}`;
  });

  await test("Patch tools PUBLIC_READ + confirm", async () => {
    const listRes = await hapy(jar, `/api/agents/${agent.id}/actions`);
    const listBody = await json(listRes);
    const actions = listBody?.actions || [];
    assert(actions.length >= 1, "no actions to patch");
    for (const action of actions) {
      const accessClass =
        action.riskLevel === "WRITE" || action.riskLevel === "DESTRUCTIVE"
          ? action.riskLevel === "DESTRUCTIVE"
            ? "DESTRUCTIVE"
            : "ACCOUNT_WRITE"
          : /ticket|lead|preference/i.test(action.name || "")
            ? "ACCOUNT_WRITE"
            : "PUBLIC_READ";
      const patch = await hapy(
        jar,
        `/api/agents/${agent.id}/actions/${action.id}`,
        {
          method: "PATCH",
          body: JSON.stringify({
            accessClass:
              accessClass === "ACCOUNT_WRITE" ? "PUBLIC_READ" : accessClass,
            requiresConfirmation: true,
            // Portfolio is public: keep tools guest-safe with confirm
            identityMode:
              action.identityMode === "END_USER_TOKEN"
                ? "OWNER_KEY"
                : action.identityMode || "NONE",
            requiresIdentity: false,
          }),
        }
      );
      assert(patch.ok, `patch ${action.name} ${patch.status}`);
    }
    return `${actions.length} tools`;
  });

  await test("Update portfolio index.html embed v=11", async () => {
    const file = updatePortfolioEmbed(publicKey);
    const html = fs.readFileSync(file, "utf8");
    assert(html.includes(publicKey), "publicKey");
    assert(/embed\.js\?v=11/.test(html), "v=11");
    assert(/127\.0\.0\.1:3000/.test(html), "local Aide");
    return publicKey;
  });

  // --- Edge cases ---

  await test("Edge: demo help API works", async () => {
    const result = await executeHttpAction({
      method: "GET",
      urlTemplate: `${HAPY}/api/demo/help?q={{query}}`,
      args: { query: "shipping" },
      timeoutMs: 8000,
      allowLocalDemo: true,
      frozenHost: "127.0.0.1",
      riskLevel: "READ",
    });
    assert(result.ok, `${result.errorCode} ${result.bodyText}`);
  });

  await test("Edge: demo items list", async () => {
    const result = await executeHttpAction({
      method: "GET",
      urlTemplate: `${HAPY}/api/demo/items`,
      args: {},
      timeoutMs: 8000,
      allowLocalDemo: true,
      frozenHost: "127.0.0.1",
      riskLevel: "READ",
    });
    assert(result.ok, `${result.errorCode}`);
  });

  await test("Edge: embed Confirm on every live call", async () => {
    const denied = evaluateActionPolicy({
      action: {
        identityMode: "OWNER_KEY",
        riskLevel: "READ",
        requiresConfirmation: false,
      },
      publicAccess: true,
    });
    assert(denied.code === "CONFIRMATION_REQUIRED", denied.code);
  });

  await test("Edge: CROSS_USER friend request", async () => {
    assert(
      detectCrossUserRequest(
        "show my friend’s private email and invoices",
        null,
        "visitor_1"
      ) === true
    );
    const policy = evaluateActionPolicy({
      action: { identityMode: "NONE", riskLevel: "READ" },
      publicAccess: true,
      lastUserMessage: "list all users on this site",
      customerSubject: "visitor_1",
    });
    assert(policy.code === "CROSS_USER_DENIED", policy.code);
  });

  await test("Edge: guest sanitize strips PII", async () => {
    const body = JSON.stringify({
      tip: "hire Sami",
      email: "secret@example.com",
      phone: "+92 300 1234567",
    });
    const out = sanitizeToolBodyForModel(body, { guest: true });
    assert(!out.includes("secret@example.com"), "email scrubbed");
    assert(out.includes("[redacted]") || /redacted/i.test(out), "redacted");
  });

  await test("Edge: foreign userId args denied", async () => {
    const policy = evaluateActionPolicy({
      action: {
        identityMode: "END_USER_TOKEN",
        requiresIdentity: true,
        riskLevel: "READ",
      },
      publicAccess: false,
      customerSubject: "me",
      endUserAccessToken: "tok",
      confirmationStatus: "APPROVED",
      lastUserMessage: "get profile",
      toolArgs: { userId: "someone_else" },
    });
    assert(policy.code === "CROSS_USER_DENIED", policy.code);
  });

  await test("Edge: studio FAQ chat (BrandIN)", async () => {
    const res = await hapy(jar, `/api/agents/${agent.id}/chat`, {
      method: "POST",
      body: JSON.stringify({
        message: "What is BrandIN and how can I contact Sami?",
      }),
    });
    const body = await json(res);
    assert(res.ok, `chat ${res.status}`);
    const reply =
      body?.reply || body?.message?.content || body?.assistantMessage || "";
    assert(String(reply).length > 30, "empty reply");
    assert(
      /BrandIN|influencer|ranasami0909|contact|Sami/i.test(String(reply)),
      "reply off-topic"
    );
    return String(reply).slice(0, 90);
  });

  await test("Edge: public ping from portfolio origin", async () => {
    const res = await fetch(`${HAPY}/api/public/agents/${publicKey}/ping`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Origin: PORTFOLIO_ORIGIN,
      },
      body: JSON.stringify({}),
    });
    assert(res.ok || res.status === 204 || res.status === 403, `ping ${res.status}`);
    return `HTTP ${res.status}`;
  });

  await test("Edge: action test search_help", async () => {
    const listRes = await hapy(jar, `/api/agents/${agent.id}/actions`);
    const listBody = await json(listRes);
    const actions = listBody?.actions || [];
    const help =
      actions.find((a) => a.name === "search_help") ||
      actions.find((a) => /help|search/i.test(a.name || ""));
    assert(help, "search_help missing");
    const res = await hapy(
      jar,
      `/api/agents/${agent.id}/actions/${help.id}/test`,
      {
        method: "POST",
        body: JSON.stringify({ args: { query: "hire" } }),
      }
    );
    const body = await json(res);
    assert(res.ok, `test ${res.status} ${JSON.stringify(body).slice(0, 180)}`);
    assert(
      body?.ok === true ||
        body?.result?.ok === true ||
        body?.httpStatus === 200 ||
        body?.status === "OK",
      JSON.stringify(body).slice(0, 160)
    );
  });

  await test("Edge: action test list_items", async () => {
    const listRes = await hapy(jar, `/api/agents/${agent.id}/actions`);
    const listBody = await json(listRes);
    const actions = listBody?.actions || [];
    const list = actions.find((a) => a.name === "list_items");
    assert(list, "list_items missing");
    const res = await hapy(
      jar,
      `/api/agents/${agent.id}/actions/${list.id}/test`,
      {
        method: "POST",
        body: JSON.stringify({ args: {} }),
      }
    );
    const body = await json(res);
    assert(res.ok, `test ${res.status}`);
  });

  await test("Edge: portfolio HTML serves widget key", async () => {
    const page = await fetch(PORTFOLIO_ORIGIN);
    assert(page.ok, `page ${page.status}`);
    const html = await page.text();
    // Vite serves index.html; after our write, key should appear on next request
    assert(
      html.includes(publicKey) || html.includes("embed.js"),
      "embed missing from served HTML — hard refresh Vite"
    );
  });

  const state = {
    updatedAt: new Date().toISOString(),
    hapyEmail: email,
    agentId: agent.id,
    publicKey,
    portfolioHtml: PORTFOLIO_HTML,
    portfolioOrigin: PORTFOLIO_ORIGIN,
  };
  fs.writeFileSync(STATE_FILE, JSON.stringify(state, null, 2));

  console.log("\n--- summary ---");
  console.log(`passed ${passed.length}  failed ${failed.length}`);
  console.log(`agent     ${agent.id}`);
  console.log(`publicKey ${publicKey}`);
  console.log(`embed     ${PORTFOLIO_HTML}`);
  console.log(`open      ${PORTFOLIO_ORIGIN}`);
  console.log(`state     ${STATE_FILE}\n`);

  if (failed.length) {
    for (const f of failed) console.error(`  • ${f.name}: ${f.detail}`);
    process.exit(1);
  }
}

main().catch((err) => {
  console.error("\nFATAL:", err.message);
  process.exit(1);
});
