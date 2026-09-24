/**
 * Chat latency per reply type vs targets (docs/features/CHAT_LATENCY_BUDGET.md).
 * Streams studio chat (NDJSON) and records, from the client:
 *   status  — first "Thinking…" line      first — first answer token
 *   done    — final line                   plus server setup spans from `done.timings`.
 *
 * Usage (dev server up): npm run bench:chat-latency
 * Env: TEST_BASE_URL (default http://127.0.0.1:3000), BENCH_SAMPLES (default 5, after 1 warmup),
 *      BENCH_EMAIL / BENCH_PASSWORD — an account with an active plan (creating agents needs one),
 *      BENCH_AGENT_ID — optional: bench an existing agent instead of creating "Latency Bench Agent".
 * Local/staging only — without BENCH_AGENT_ID it creates an agent and one knowledge document.
 */
import "dotenv/config";

const BASE = (process.env.TEST_BASE_URL || "http://127.0.0.1:3000").replace(/\/$/, "");
const SAMPLES = Math.min(20, Math.max(1, Number(process.env.BENCH_SAMPLES) || 5));
const EMAIL = process.env.BENCH_EMAIL || "latency-bench@aide.test";
const PASSWORD = process.env.BENCH_PASSWORD || "LatencyBench1!";
const AGENT_NAME = "Latency Bench Agent";

/** Targets (ms): p50 / p95 of first answer token; status within 300 ms. */
const TYPES = [
  { key: "greeting", message: "hi", first: [800, 1500] },
  { key: "knowledge", message: "How many days do I have to return an order?", first: [1200, 2000] },
  { key: "general", message: "In one sentence, what is an API?", first: [800, 1500] },
  { key: "followup", message: "And can I return a used item?", first: [1200, 2000], followup: true },
];
const STATUS_TARGET_MS = 300;
const KNOWLEDGE = {
  name: "Returns policy",
  content:
    "Returns: customers can return any order within 30 days of delivery for a full refund. Items must be unused and in original packaging. Refunds reach the original payment method within 5 business days.",
};

function jar() {
  const cookies = new Map();
  return {
    absorb(res) {
      for (const raw of res.headers.getSetCookie?.() || []) {
        const [pair] = raw.split(";");
        const index = pair.indexOf("=");
        if (index > 0) cookies.set(pair.slice(0, index).trim(), pair.slice(index + 1).trim());
      }
    },
    header: () => [...cookies].map(([k, v]) => `${k}=${v}`).join("; "),
  };
}

async function api(cookies, path, options = {}) {
  const res = await fetch(`${BASE}${path}`, {
    ...options,
    headers: { Cookie: cookies.header(), ...(options.body ? { "Content-Type": "application/json" } : {}), ...(options.headers || {}) },
  });
  const text = await res.text();
  let body = null;
  try {
    body = JSON.parse(text);
  } catch {
    body = text;
  }
  return { res, body };
}

async function signIn() {
  // Only the default local bench user is registered; a provided account is used as-is.
  if (!process.env.BENCH_EMAIL) {
    const reg = await fetch(`${BASE}/api/auth/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "Latency Bench", email: EMAIL, password: PASSWORD, confirmPassword: PASSWORD }),
    });
    if (!reg.ok && reg.status !== 409 && reg.status !== 400) throw new Error(`register ${reg.status}`);
  }
  const cookies = jar();
  const csrfRes = await fetch(`${BASE}/api/auth/csrf`);
  cookies.absorb(csrfRes);
  const { csrfToken } = await csrfRes.json();
  const login = await fetch(`${BASE}/api/auth/callback/credentials`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded", Cookie: cookies.header() },
    body: new URLSearchParams({ csrfToken, email: EMAIL, password: PASSWORD, redirect: "false" }),
    redirect: "manual",
  });
  cookies.absorb(login);
  const session = await api(cookies, "/api/auth/session");
  if (session.body?.user?.email !== EMAIL) throw new Error(`sign-in failed for ${EMAIL}`);
  return cookies;
}

async function ensureAgent(cookies) {
  if (process.env.BENCH_AGENT_ID) return process.env.BENCH_AGENT_ID;
  const list = await api(cookies, "/api/agents");
  const agents = list.body?.agents || list.body?.data?.agents || (Array.isArray(list.body) ? list.body : []);
  let agent = agents.find((a) => a.name === AGENT_NAME);
  if (!agent) {
    const created = await api(cookies, "/api/agents", {
      method: "POST",
      body: JSON.stringify({ name: AGENT_NAME, systemPrompt: "You are a concise support agent for an online store.", welcomeMessage: "Hi — how can I help?" }),
    });
    if (created.res.status === 402) throw new Error("create agent needs a plan: set BENCH_EMAIL/BENCH_PASSWORD to a billed account, or BENCH_AGENT_ID");
    if (!created.res.ok) throw new Error(`create agent ${created.res.status}: ${JSON.stringify(created.body).slice(0, 200)}`);
    agent = created.body?.agent || created.body?.data?.agent || created.body;
  }
  const docs = await api(cookies, `/api/agents/${agent.id}/knowledge`);
  const docList = docs.body?.documents || docs.body?.data || (Array.isArray(docs.body) ? docs.body : []);
  if (!Array.isArray(docList) || !docList.some((d) => d.name === KNOWLEDGE.name)) {
    const added = await api(cookies, `/api/agents/${agent.id}/knowledge`, { method: "POST", body: JSON.stringify(KNOWLEDGE) });
    if (!added.res.ok) throw new Error(`add knowledge ${added.res.status}`);
  }
  return agent.id;
}

async function streamTurn(cookies, agentId, message, conversationId) {
  const t0 = performance.now();
  const res = await fetch(`${BASE}/api/agents/${agentId}/chat`, {
    method: "POST",
    headers: { Cookie: cookies.header(), "Content-Type": "application/json", Accept: "application/x-ndjson" },
    body: JSON.stringify({ message, stream: true, clientMessageId: `bench-${Date.now()}-${Math.random().toString(36).slice(2)}`, ...(conversationId ? { conversationId } : {}) }),
  });
  if (!res.ok || !res.body) throw new Error(`chat ${res.status}`);
  const out = { status: null, first: null, done: null, timings: null, conversationId: null, error: null };
  const decoder = new TextDecoder();
  let buffer = "";
  for await (const chunk of res.body) {
    buffer += decoder.decode(chunk, { stream: true });
    let newline;
    while ((newline = buffer.indexOf("\n")) >= 0) {
      const line = buffer.slice(0, newline).trim();
      buffer = buffer.slice(newline + 1);
      if (!line) continue;
      const event = JSON.parse(line);
      const at = Math.round(performance.now() - t0);
      if (event.type === "status" && event.phase === "thinking" && out.status == null) out.status = at;
      if (event.type === "meta" && event.conversationId) out.conversationId = event.conversationId;
      if (event.type === "text" && event.delta && out.first == null) out.first = at;
      if (event.type === "error") out.error = event.code;
      if (event.type === "done") {
        out.done = at;
        out.timings = event.body?.data?.timings || null;
        out.conversationId = event.body?.data?.conversationId || out.conversationId;
      }
    }
  }
  if (out.error) throw new Error(`stream error ${out.error}`);
  return out;
}

const pct = (values, p) => {
  const sorted = values.filter((v) => typeof v === "number").sort((a, b) => a - b);
  if (!sorted.length) return null;
  return sorted[Math.min(sorted.length - 1, Math.max(0, Math.ceil((p / 100) * sorted.length) - 1))];
};
const fmt = (ms) => (ms == null ? "—" : ms >= 1000 ? `${(ms / 1000).toFixed(2)}s` : `${ms}ms`);

async function main() {
  console.log(`Chat latency bench @ ${BASE} (samples=${SAMPLES} + 1 warmup)\n`);
  const cookies = await signIn();
  const agentId = await ensureAgent(cookies);
  const report = [];
  let failed = false;
  for (const type of TYPES) {
    const rows = [];
    for (let i = 0; i <= SAMPLES; i += 1) {
      let conversationId = null;
      if (type.followup) conversationId = (await streamTurn(cookies, agentId, "What is your returns policy?", null)).conversationId;
      const row = await streamTurn(cookies, agentId, type.message, conversationId);
      if (i > 0) rows.push(row);
    }
    const first50 = pct(rows.map((r) => r.first), 50);
    const first95 = pct(rows.map((r) => r.first), 95);
    const status95 = pct(rows.map((r) => r.status), 95);
    const ok = first50 != null && first50 <= type.first[0] && first95 <= type.first[1] && status95 <= STATUS_TARGET_MS;
    if (!ok) failed = true;
    const spanKeys = ["agent", "conversation", "turnRun", "access", "userMessage", "turnContext", "firstToken", "model", "persisted"];
    const spans = Object.fromEntries(spanKeys.map((k) => [k, pct(rows.map((r) => r.timings?.[k]), 50)]));
    report.push({ type: type.key, status95, first50, first95, done50: pct(rows.map((r) => r.done), 50), spans, ok });
    console.log(
      `${ok ? "PASS" : "OVER"} ${type.key.padEnd(10)} status p95 ${fmt(status95).padStart(6)} | first token p50 ${fmt(first50).padStart(6)} p95 ${fmt(first95).padStart(6)} (target ${fmt(type.first[0])}/${fmt(type.first[1])}) | done p50 ${fmt(pct(rows.map((r) => r.done), 50))}`
    );
    console.log(`     server p50 (ms since start): ${spanKeys.map((k) => `${k} ${spans[k] ?? "—"}`).join(" · ")}`);
  }
  const { mkdir, writeFile } = await import("node:fs/promises");
  await mkdir(".tmp", { recursive: true });
  await writeFile(".tmp/chat-latency-bench.json", JSON.stringify({ base: BASE, samples: SAMPLES, at: new Date().toISOString(), report }, null, 2));
  console.log(`\n${failed ? "Some reply types are over target." : "All reply types within target."} Report: .tmp/chat-latency-bench.json`);
}

main().catch((error) => {
  console.error(`HARNESS_BLOCKED: ${error.message}`);
  process.exit(2);
});
