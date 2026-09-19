/**
 * Studio architecture audit — browser + authenticated chat API.
 * Covers: copy UI, knowledge, crawl KB, web search, HTTP tools, MCP refuse path.
 *
 * Usage (app on TEST_BASE_URL / localhost:3000):
 *   node scripts/audit-studio-architecture-browser.mjs
 *
 * Writes: .tmp/studio-architecture-audit.json + .tmp/studio-architecture-audit.md
 */
import "dotenv/config";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { randomUUID } from "node:crypto";
import { chromium } from "playwright";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const BASE = (
  process.env.TEST_BASE_URL ||
  process.env.NEXT_PUBLIC_APP_URL ||
  "http://localhost:3000"
)
  .replace(/\/$/, "")
  .replace("127.0.0.1", "localhost");
const outJson = path.join(root, ".tmp/studio-architecture-audit.json");
const outMd = path.join(root, ".tmp/studio-architecture-audit.md");

const CASES = [
  {
    id: "COPY_UI",
    kind: "ui",
    prompt: null,
    expect: "Copy control under assistant bubble after a reply",
  },
  {
    id: "KB_FAQ",
    kind: "knowledge",
    prompt: "What is your refund policy?",
    expect: "Grounded knowledge answer and/or Used knowledge label",
  },
  {
    id: "KB_PRICING",
    kind: "knowledge",
    prompt: "What plans and pricing do you offer?",
    expect: "Store/knowledge route; no invented live MCP inventory",
  },
  {
    id: "CRAWL_KB_ASK",
    kind: "crawl",
    prompt:
      "From your knowledge base, what does the example.com crawl snapshot say the site is about?",
    expect: "Uses crawl/FAQ knowledge if seeded; else honest gap",
  },
  {
    id: "WEB_SEARCH",
    kind: "web",
    prompt: "Search online for the official Next.js documentation URL",
    expect: "Online/web_search when enabled; searchUsed or Online source",
  },
  {
    id: "HTTP_PUBLIC_TOOL",
    kind: "http",
    prompt:
      "Call the list_items tool now and list the public demo items it returns. Do not invent items.",
    expect: "HTTP/demo list_items tool call when pack installed",
  },
  {
    id: "MCP_GITHUB_REPOS",
    kind: "mcp",
    prompt:
      "Use the connected GitHub MCP tools to search repositories for query: next.js language:JavaScript. Prefer search_repositories.",
    expect: "MCP search tool or clear refuse — not Brandly soft knowledge",
  },
  {
    id: "MCP_WRONG_TOOL_GUARD",
    kind: "mcp",
    prompt:
      "List all GitHub repositories for user saadkhan7336 that contain JavaScript code using GitHub tools",
    expect: "search_repositories (or refuse) — not invented full list after error",
  },
];

function ensureTmp() {
  fs.mkdirSync(path.join(root, ".tmp"), { recursive: true });
}

async function registerAndLogin(page, request) {
  const password = "ArchAudit!2026";
  const email = `arch-audit-${Date.now()}-${randomUUID().slice(0, 6)}@aide.test`;

  const register = await request.post(`${BASE}/api/auth/register`, {
    data: {
      name: "Architecture Audit",
      email,
      password,
      confirmPassword: password,
    },
  });
  if (![200, 201].includes(register.status())) {
    throw new Error(`register failed ${register.status()}`);
  }

  await page.goto(`${BASE}/login`);
  const csrf = await request.get(`${BASE}/api/auth/csrf`).then((r) => r.json());
  const login = await request.post(`${BASE}/api/auth/callback/credentials`, {
    form: {
      csrfToken: csrf.csrfToken,
      email,
      password,
      redirect: "false",
    },
    maxRedirects: 0,
  });
  if (![200, 302, 303].includes(login.status())) {
    throw new Error(`login failed ${login.status()}`);
  }

  await request.post(`${BASE}/api/onboarding`, {
    data: {
      firstName: "Arch",
      lastName: "Audit",
      phone: "+923001112233",
      country: "PK",
      websiteUrl: "https://example.com",
      companyType: "SaaS",
      teamSize: "Just me",
      monthlyConversations: "Under 100 / month",
      primaryGoal: "AI + human handoff",
    },
  });

  const plans = await request.get(`${BASE}/api/billing/plans`).then((r) => r.json());
  const freePlan = (plans.plans || []).find((p) => p.planType === "FREE");
  if (freePlan?.id) {
    await request.post(`${BASE}/api/billing/subscribe`, {
      data: { planId: freePlan.id },
    });
  }

  return { email };
}

async function createAuditAgent(request) {
  const res = await request.post(`${BASE}/api/agents`, {
    data: {
      name: `Arch Audit ${new Date().toISOString().slice(0, 16)}`,
      welcomeMessage: "Architecture audit agent ready.",
      systemPrompt:
        "You are a support agent. Prefer Agent knowledge for store facts. Use web_search only when asked for online/internet info. Prefer connected MCP GitHub search tools for repository inventory. Never invent tool results. When list_items is available, call it for catalog questions.",
      webSearchEnabled: true,
      actionsEnabled: true,
    },
  });
  if (res.status() !== 201) {
    const body = await res.text();
    throw new Error(`create agent ${res.status()}: ${body.slice(0, 200)}`);
  }
  return res.json();
}

async function seedKnowledge(request, agentId) {
  const res = await request.post(`${BASE}/api/agents/${agentId}/knowledge`, {
    data: {
      name: "Audit Refund FAQ",
      type: "TEXT",
      content:
        "Refund policy: customers may return items within 5 business days for a full refund. Contact support with your order id. Plans: Starter free, Pro $29/month, Business $99/month.",
    },
  });
  return { status: res.status(), ok: res.ok() };
}

async function seedCrawlKnowledge(request, agentId) {
  const res = await request.post(`${BASE}/api/agents/${agentId}/knowledge`, {
    data: {
      name: "example.com crawl snapshot",
      type: "TEXT",
      content:
        "Crawled from https://example.com: Example Domain. This domain is for use in illustrative examples in documents. You may use this domain in literature without prior coordination or asking for permission.",
    },
  });
  let crawlApi = null;
  try {
    const crawl = await request.post(`${BASE}/api/onboarding/crawl`, {
      data: {},
    });
    crawlApi = {
      status: crawl.status(),
      ok: crawl.ok(),
      body: (await crawl.text()).slice(0, 400),
    };
  } catch (err) {
    crawlApi = { ok: false, error: err.message };
  }
  return { textSeed: { status: res.status(), ok: res.ok() }, crawlApi };
}

async function enableWebSearch(request, agentId) {
  const put = await request.put(`${BASE}/api/agents/${agentId}`, {
    data: {
      webSearchEnabled: true,
      actionsEnabled: true,
    },
  });
  return { ok: put.ok(), status: put.status(), body: (await put.text()).slice(0, 200) };
}

async function installDemoTools(request, agentId) {
  const pack = await request.post(`${BASE}/api/agents/${agentId}/action-packs`, {
    data: { packId: "site_demo_v1" },
  });
  const packBody = await pack.json().catch(() => ({}));
  if (![200, 201].includes(pack.status())) {
    return { ok: false, status: pack.status(), body: packBody };
  }

  const listRes = await request.get(`${BASE}/api/agents/${agentId}/actions`);
  const listBody = await listRes.json().catch(() => ({}));
  const actions = listBody?.actions || [];
  for (const action of actions) {
    await request.patch(`${BASE}/api/agents/${agentId}/actions/${action.id}`, {
      data: {
        accessClass: "PUBLIC_READ",
        requiresConfirmation: false,
        requiresIdentity: false,
        identityMode: "NONE",
        enabled: true,
      },
    });
  }
  return {
    ok: true,
    status: pack.status(),
    created: (packBody.created || []).map((a) => a.name),
    actionCount: actions.length,
  };
}

function chatComposer(page) {
  return page.getByPlaceholder(
    /Type a test message|Type a test as the logged-in|Type your own test|Type a message/i
  );
}

async function waitForStudioReady(page, agentId) {
  await page.goto(`${BASE}/agents/${agentId}/test`, {
    waitUntil: "domcontentloaded",
    timeout: 60_000,
  });
  // Prefer visitor mode so composer placeholder is stable
  const signedInSwitch = page.getByLabel(/Test as logged-in customer/i);
  if (await signedInSwitch.count()) {
    const checked = await signedInSwitch.isChecked().catch(() => false);
    if (checked) await signedInSwitch.click();
  }
  await chatComposer(page).waitFor({ state: "visible", timeout: 90_000 });
}

async function sendStudioChatBrowser(page, prompt) {
  const input = chatComposer(page);
  await input.waitFor({ state: "visible", timeout: 30_000 });
  await input.click();
  await input.fill(prompt);
  const send = page.getByRole("button", { name: /^send$/i }).first();
  if (await send.isEnabled().catch(() => false)) {
    await send.click();
  } else {
    await input.press("Enter");
  }
}

async function waitForNewCopy(page, previousCount) {
  const deadline = Date.now() + 90_000;
  while (Date.now() < deadline) {
    const n = await page.getByRole("button", { name: /Copy message|Copied/i }).count();
    if (n > previousCount) {
      await page.waitForTimeout(1000);
      return n;
    }
    await page.waitForTimeout(400);
  }
  throw new Error("Timed out waiting for new copy control / assistant reply");
}

async function captureBrowserUi(page) {
  const copyButtonCount = await page
    .getByRole("button", { name: /Copy message|Copied/i })
    .count();
  const bodies = page.locator("div.markdown-body");
  const bodyCount = await bodies.count();
  const lastText =
    bodyCount > 0
      ? await bodies.nth(bodyCount - 1).innerText().catch(() => "")
      : "";
  return { copyButtonCount, lastAssistantText: lastText };
}

async function postChat(request, agentId, message, conversationId) {
  const t0 = Date.now();
  const res = await request.post(`${BASE}/api/agents/${agentId}/chat`, {
    data: {
      message,
      ...(conversationId ? { conversationId } : {}),
      stream: false,
    },
    timeout: 120_000,
  });
  const text = await res.text();
  let json = null;
  try {
    json = JSON.parse(text);
  } catch {
    json = null;
  }
  return {
    status: res.status(),
    ok: res.ok(),
    latencyMs: Date.now() - t0,
    raw: text,
    json,
    conversationId: json?.conversationId || conversationId || null,
  };
}

function scoreFromApi(caseDef, api) {
  const findings = [];
  let status = "PASS";
  const j = api.json || {};
  const content = String(j?.message?.content || "");
  const text = content.toLowerCase();
  const usedKnowledge = Array.isArray(j.usedKnowledge) ? j.usedKnowledge : [];
  const toolSteps = Array.isArray(j.toolSteps) ? j.toolSteps : [];
  const toolNames = toolSteps
    .map((t) => t?.name || t?.toolName || t?.actionName || "")
    .filter(Boolean);
  const knowledgeNames = usedKnowledge.map((k) => k.name || k.title || "").join(" · ");
  const searchUsed = Boolean(j.searchUsed);
  const sources = Array.isArray(j.sources) ? j.sources : [];

  if (!api.ok || !content.trim()) {
    return {
      status: "FAIL",
      findings: [`Chat HTTP ${api.status}`, content ? "empty content?" : "no assistant content"],
      lastAssistantText: content,
      usedKnowledge: knowledgeNames || null,
      sources: sources.join(", ") || null,
      called: toolNames.join(", ") || null,
      apiSnippet: api.raw?.slice(0, 2500),
    };
  }

  if (caseDef.kind === "knowledge") {
    if (knowledgeNames) findings.push(`usedKnowledge: ${knowledgeNames}`);
    if (/5 business days|refund|starter|\$29|pro|\$99|business/i.test(content)) {
      findings.push("Answer references seeded FAQ");
    } else if (knowledgeNames) {
      findings.push("Knowledge retrieved but weak FAQ phrasing");
      status = "PARTIAL";
    } else {
      status = "FAIL";
      findings.push("No usedKnowledge and no FAQ match");
    }
  }

  if (caseDef.kind === "crawl") {
    if (/example domain|illustrative examples|example\.com/i.test(content)) {
      findings.push("Crawl snapshot grounded");
    } else if (/crawl snapshot|example\.com/i.test(knowledgeNames)) {
      findings.push(`Knowledge hit: ${knowledgeNames}`);
      status = "PARTIAL";
    } else {
      status = "PARTIAL";
      findings.push("Weak crawl grounding");
    }
    if (knowledgeNames) findings.push(`usedKnowledge: ${knowledgeNames}`);
  }

  if (caseDef.kind === "web") {
    if (searchUsed || sources.some((s) => /online|web/i.test(String(s)))) {
      findings.push(searchUsed ? "searchUsed=true" : `sources=${sources.join(",")}`);
    } else if (/nextjs\.org|next\.js/i.test(content) && /http/i.test(content)) {
      findings.push("Answer has Next.js URL without searchUsed flag");
      status = "PARTIAL";
    } else if (toolNames.some((n) => /web_search/i.test(n))) {
      findings.push(`tool: ${toolNames.join(",")}`);
    } else {
      status = "PARTIAL";
      findings.push("Could not confirm web_search / Online");
    }
  }

  if (caseDef.kind === "http") {
    if (toolNames.some((n) => /list_items/i.test(n))) {
      findings.push(`Called ${toolNames.join(", ")}`);
    } else if (toolNames.length) {
      findings.push(`Other tools: ${toolNames.join(", ")}`);
      status = "PARTIAL";
    } else if (/cannot|don't have|do not have|unavailable|no .*tool/i.test(text)) {
      findings.push("Honest cannot (unexpected if pack installed)");
      status = "FAIL";
    } else {
      status = "FAIL";
      findings.push("No list_items tool step");
    }
  }

  if (caseDef.kind === "mcp") {
    if (/brandly/i.test(knowledgeNames)) {
      status = "FAIL";
      findings.push("Brandly knowledge on GitHub ask");
    }
    if (toolNames.some((n) => /mcp_|github|search_repositories/i.test(n))) {
      findings.push(`MCP/tools: ${toolNames.join(", ")}`);
    } else if (
      /could not retrieve that github inventory|connected mcp|no connected|mcp.*(not|isn't|unavailable)|don't have access to github|do not have.*github|github tools? (are )?(not|unavailable)/i.test(
        text
      )
    ) {
      findings.push("Fail-closed refuse (expected without MCP OAuth on fresh agent)");
    } else if (/repositor/i.test(text) && /\b\d+\b/.test(text) && !/cannot|unable|don't|do not/i.test(text)) {
      status = "FAIL";
      findings.push("Invented repository inventory without MCP tool");
    } else {
      status = "PARTIAL";
      findings.push("Ambiguous MCP response — no tool and no clear refuse");
    }
  }

  return {
    status,
    findings,
    lastAssistantText: content,
    usedKnowledge: knowledgeNames || null,
    sources: [...sources, searchUsed ? "searchUsed" : null].filter(Boolean).join(", ") || null,
    called: toolNames.join(", ") || null,
    apiSnippet: api.raw?.slice(0, 3000),
    toolSteps,
    knowledgeEvidence: j.knowledgeEvidence || null,
  };
}

function toMarkdown(report) {
  const lines = [
    `# Studio architecture audit`,
    ``,
    `- When: ${report.startedAt}`,
    `- Base: ${report.base}`,
    `- Agent: ${report.agentId || "(none)"}`,
    `- Overall: **${report.overall}**`,
    `- Setup: \`${JSON.stringify(report.setup || {})}\``,
    ``,
    `## Fixes already in codebase (this session)`,
    ``,
    ...report.priorFixes.map((f) => `- ${f}`),
    ``,
    `## Cases`,
    ``,
  ];
  for (const c of report.cases) {
    lines.push(`### ${c.id} — ${c.status}`);
    lines.push(`- Expect: ${c.expect}`);
    if (c.prompt) lines.push(`- Prompt: ${JSON.stringify(c.prompt)}`);
    if (c.latencyMs != null) lines.push(`- Latency: ${c.latencyMs}ms`);
    lines.push(`- Findings: ${(c.findings || []).join("; ") || "—"}`);
    if (c.usedKnowledge) lines.push(`- Used knowledge: ${c.usedKnowledge}`);
    if (c.sources) lines.push(`- Sources: ${c.sources}`);
    if (c.called) lines.push(`- Called: ${c.called}`);
    if (c.lastAssistantText) {
      lines.push(``);
      lines.push("```");
      lines.push(String(c.lastAssistantText).slice(0, 4000));
      lines.push("```");
    }
    if (c.apiSnippet) {
      lines.push(``);
      lines.push("<details><summary>API response snippet</summary>");
      lines.push("");
      lines.push("```json");
      lines.push(String(c.apiSnippet).slice(0, 3000));
      lines.push("```");
      lines.push("</details>");
    }
    lines.push("");
  }
  if (report.blockers.length) {
    lines.push(`## Blockers`);
    for (const b of report.blockers) lines.push(`- ${b}`);
    lines.push("");
  }
  if (report.fixesAppliedThisRun?.length) {
    lines.push(`## Fixes applied during this audit run`);
    for (const f of report.fixesAppliedThisRun) lines.push(`- ${f}`);
    lines.push("");
  }
  return lines.join("\n");
}

async function main() {
  ensureTmp();
  const startedAt = new Date().toISOString();
  const report = {
    startedAt,
    base: BASE,
    agentId: null,
    overall: "FAIL",
    blockers: [],
    cases: [],
    setup: {},
    priorFixes: [
      "Studio message copy icon under bubbles (MessageBubble + MessageList showCopy)",
      "GitHub turns skip Brandly soft-fallback knowledge badge",
      "MCP_TOOL_ERROR detail framing + fail-closed inventory refuse",
      "hostedWebRoute no longer skips MCP when wantsGithub / MCP offered",
      "Studio Sources chips: Knowledge / Connected GitHub|MCP / Online",
      "allowedDevOrigins includes 127.0.0.1 + localhost for Next.dev /_next chunks",
      "Onboarding crawl: remove invalid Agent.deletedAt filter (Prisma fail)",
      "Orchestrator: wantsGithub + no MCP offered → refuse (no search_help substitute)",
    ],
    fixesAppliedThisRun: [
      "Audit harness: use localhost (avoid Next.dev 127.0.0.1 /_next 403)",
      "Audit harness: content cases via /api/agents/:id/chat (browser only for copy UI)",
      "Audit harness: PUT webSearchEnabled (PATCH was 405)",
      "next.config allowedDevOrigins adds 127.0.0.1 + localhost",
      "Fix crawl seedWebsiteKnowledgeFromProfile prisma.agent.findFirst (deletedAt)",
      "Fix GitHub asks without MCP: early GITHUB_INVENTORY_REFUSE in orchestrator loop",
    ],
  };

  try {
    const health = await fetch(`${BASE}/api/health`).then((r) => r.json());
    if (health?.status !== "ok") {
      report.blockers.push(`Health not ok: ${JSON.stringify(health)}`);
    }
  } catch (err) {
    report.blockers.push(`App not reachable at ${BASE}: ${err.message}`);
    fs.writeFileSync(outJson, JSON.stringify(report, null, 2));
    fs.writeFileSync(outMd, toMarkdown(report));
    console.error("BLOCKED", report.blockers.join("; "));
    process.exit(2);
  }

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();
  const request = context.request;
  let conversationId = null;

  try {
    await registerAndLogin(page, request);
    const agent = await createAuditAgent(request);
    report.agentId = agent.id;
    report.setup.knowledgeSeed = await seedKnowledge(request, agent.id);
    report.setup.crawl = await seedCrawlKnowledge(request, agent.id);
    report.setup.webSearch = await enableWebSearch(request, agent.id);
    report.setup.demoTools = await installDemoTools(request, agent.id);

    // Browser: copy UI path
    await waitForStudioReady(page, agent.id);
    const prevCopy = await page.getByRole("button", { name: /Copy message|Copied/i }).count();
    await sendStudioChatBrowser(page, "Reply with exactly: Audit copy check OK");
    await waitForNewCopy(page, prevCopy);
    const ui = await captureBrowserUi(page);
    report.cases.push({
      id: "COPY_UI",
      kind: "ui",
      prompt: "Reply with exactly: Audit copy check OK",
      expect: "Copy control under assistant bubble after a reply",
      status: ui.copyButtonCount >= 1 ? "PASS" : "FAIL",
      findings:
        ui.copyButtonCount >= 1
          ? [`Found ${ui.copyButtonCount} copy control(s)`]
          : ["No copy button found"],
      lastAssistantText: ui.lastAssistantText,
      copyButtonCount: ui.copyButtonCount,
    });

    // API-backed architecture cases (same session cookies)
    for (const caseDef of CASES) {
      if (caseDef.id === "COPY_UI") continue;
      const api = await postChat(request, agent.id, caseDef.prompt, conversationId);
      conversationId = api.conversationId || conversationId;
      const scored = scoreFromApi(caseDef, api);
      report.cases.push({
        ...caseDef,
        ...scored,
        latencyMs: api.latencyMs,
        httpStatus: api.status,
      });
    }
  } catch (err) {
    report.blockers.push(err.message || String(err));
    try {
      await page.screenshot({
        path: path.join(root, ".tmp/studio-audit-error.png"),
        fullPage: true,
      });
    } catch {
      // ignore
    }
  } finally {
    await browser.close();
  }

  const statuses = report.cases.map((c) => c.status);
  if (report.blockers.length && !report.cases.length) report.overall = "BLOCKED";
  else if (statuses.includes("FAIL")) report.overall = "FAIL";
  else if (statuses.includes("PARTIAL")) report.overall = "PARTIAL";
  else if (statuses.length) report.overall = "PASS";
  else report.overall = "BLOCKED";

  fs.writeFileSync(outJson, JSON.stringify(report, null, 2));
  fs.writeFileSync(outMd, toMarkdown(report));
  console.log(`overall=${report.overall}`);
  console.log(`wrote ${outMd}`);
  for (const c of report.cases) {
    console.log(`${c.id}=${c.status}`);
  }
  if (report.blockers.length) {
    console.log("blockers:");
    for (const b of report.blockers) console.log(`- ${b}`);
  }
  process.exit(report.overall === "BLOCKED" ? 2 : report.overall === "FAIL" ? 1 : 0);
}

main().catch((err) => {
  console.error(err);
  process.exit(2);
});
