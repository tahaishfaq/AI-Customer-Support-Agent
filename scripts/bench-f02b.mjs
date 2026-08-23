/**
 * F02 Phase B — measure chat / analytics / admin dashboard latency.
 *
 * Usage (dev server up):
 *   npm run bench:f02b
 *
 * Optional env:
 *   TEST_BASE_URL          default http://127.0.0.1:3000
 *   F02_BENCH_SAMPLES      default 5 (after 1 warmup)
 *   ADMIN_BOOTSTRAP_EMAIL / ADMIN_BOOTSTRAP_PASSWORD — admin dashboard
 *   F02_BENCH_EMAIL / F02_BENCH_PASSWORD — product user (or auto-register)
 *   F02_BENCH_SKIP_CHAT=1  skip OpenAI studio chat samples
 *
 * Prints p50 / p95 (client wall ms) and server x-hapy-duration-ms when present.
 */
import "dotenv/config";

const BASE = (process.env.TEST_BASE_URL || "http://127.0.0.1:3000").replace(
  /\/$/,
  ""
);
const SAMPLES = Math.min(
  30,
  Math.max(1, Number(process.env.F02_BENCH_SAMPLES) || 5)
);
const SKIP_CHAT = process.env.F02_BENCH_SKIP_CHAT === "1";

function percentile(sorted, p) {
  if (sorted.length === 0) return null;
  const idx = Math.min(
    sorted.length - 1,
    Math.max(0, Math.ceil((p / 100) * sorted.length) - 1)
  );
  return sorted[idx];
}

function summarize(label, rows) {
  const client = rows.map((r) => r.clientMs).sort((a, b) => a - b);
  const server = rows
    .map((r) => r.serverMs)
    .filter((n) => typeof n === "number")
    .sort((a, b) => a - b);
  const line = (arr, name) =>
    arr.length
      ? `${name} p50=${percentile(arr, 50)}ms p95=${percentile(arr, 95)}ms (n=${arr.length})`
      : `${name} n=0`;
  console.log(`  ${label}`);
  console.log(`    ${line(client, "client")}`);
  if (server.length) console.log(`    ${line(server, "server")}`);
  return {
    label,
    clientP50: percentile(client, 50),
    clientP95: percentile(client, 95),
    serverP50: percentile(server, 50),
    serverP95: percentile(server, 95),
    n: rows.length,
  };
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
    return { _raw: text.slice(0, 200) };
  }
}

async function signIn(email, password) {
  const jar = cookieJar();
  const csrfRes = await fetch(`${BASE}/api/auth/csrf`);
  jar.absorb(csrfRes);
  const csrf = await json(csrfRes);
  if (!csrf?.csrfToken) throw new Error("csrf missing");

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
  if (session?.user?.email !== email) {
    throw new Error(`sign-in failed for ${email}`);
  }
  return jar;
}

async function timedFetch(jar, path, options = {}) {
  const headers = {
    Cookie: jar.header(),
    ...(options.body ? { "Content-Type": "application/json" } : {}),
    ...(options.headers || {}),
  };
  const t0 = Date.now();
  const res = await fetch(`${BASE}${path}`, { ...options, headers });
  const clientMs = Date.now() - t0;
  const serverRaw = res.headers.get("x-hapy-duration-ms");
  const serverMs = serverRaw != null ? Number(serverRaw) : null;
  const body = await json(res);
  return { res, body, clientMs, serverMs };
}

async function sample(fn, times) {
  // warmup
  await fn();
  const rows = [];
  for (let i = 0; i < times; i += 1) {
    rows.push(await fn());
  }
  return rows;
}

async function ensureProductUser() {
  const email =
    process.env.F02_BENCH_EMAIL || `f02-bench-${Date.now()}@hapy.test`;
  const password = process.env.F02_BENCH_PASSWORD || "F02BenchPass1!";

  if (!process.env.F02_BENCH_EMAIL) {
    const reg = await fetch(`${BASE}/api/auth/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: "F02 Bench",
        email,
        password,
        confirmPassword: password,
      }),
    });
    if (!reg.ok && reg.status !== 409) {
      const body = await json(reg);
      throw new Error(
        `register failed ${reg.status}: ${body?.error?.message || ""}`
      );
    }
  }

  return { email, password, jar: await signIn(email, password) };
}

async function ensureAgent(jar) {
  const listRes = await timedFetch(jar, "/api/agents");
  if (!listRes.res.ok) {
    throw new Error(`GET /api/agents ${listRes.res.status}`);
  }
  const agents = listRes.body?.agents || listRes.body || [];
  if (Array.isArray(agents) && agents[0]?.id) return agents[0].id;

  const create = await timedFetch(jar, "/api/agents", {
    method: "POST",
    body: JSON.stringify({
      name: "F02 Bench Agent",
      systemPrompt: "You are a helpful support agent for F02 benchmarks.",
      welcomeMessage: "Hi — how can I help?",
    }),
  });
  if (!create.res.ok) {
    throw new Error(
      `create agent ${create.res.status}: ${create.body?.error?.message || JSON.stringify(create.body?.error?.details || {})}`
    );
  }
  return create.body?.agent?.id || create.body?.id;
}

async function main() {
  console.log(`F02-B bench @ ${BASE} (samples=${SAMPLES})\n`);

  try {
    const health = await fetch(`${BASE}/api/health`);
    if (!health.ok) throw new Error(`health ${health.status}`);
  } catch (error) {
    console.log(`skip live bench (server not reachable: ${error.message})`);
    console.log("Start `npm run dev` then re-run: npm run bench:f02b");
    process.exit(0);
  }

  const results = [];
  let productJar = null;
  let agentId = null;

  // Product analytics (+ optional studio chat)
  try {
    try {
      const ensured = await ensureProductUser();
      productJar = ensured.jar;
    } catch (regErr) {
      const adminEmail = process.env.ADMIN_BOOTSTRAP_EMAIL;
      const adminPassword = process.env.ADMIN_BOOTSTRAP_PASSWORD;
      if (!adminEmail || !adminPassword) throw regErr;
      console.log(
        `  product register/sign-in failed (${regErr.message}); falling back to admin session`
      );
      productJar = await signIn(adminEmail, adminPassword);
    }
    agentId = null;
    try {
      agentId = await ensureAgent(productJar);
    } catch (agentErr) {
      console.log(`  ensure agent: ${agentErr.message}`);
    }

    const analyticsRows = await sample(async () => {
      const { res, clientMs, serverMs } = await timedFetch(
        productJar,
        "/api/analytics/dashboard?range=7d"
      );
      if (!res.ok) throw new Error(`analytics ${res.status}`);
      return { clientMs, serverMs };
    }, SAMPLES);
    results.push(summarize("GET /api/analytics/dashboard?range=7d", analyticsRows));

    if (!SKIP_CHAT) {
      if (!agentId) {
        console.log("  skip studio chat (no agentId)");
      } else {
        const chatRows = await sample(async () => {
          const { res, clientMs, serverMs } = await timedFetch(
            productJar,
            `/api/agents/${agentId}/chat`,
            {
              method: "POST",
              body: JSON.stringify({ message: "What is your return policy?" }),
            }
          );
          if (!res.ok) throw new Error(`studio chat ${res.status}`);
          return { clientMs, serverMs };
        }, Math.min(SAMPLES, 3));
        results.push(
          summarize(
            "POST studio chat (TTFT≈total; no stream)",
            chatRows
          )
        );
      }
    } else {
      console.log("  skip studio chat (F02_BENCH_SKIP_CHAT=1)");
    }
  } catch (error) {
    console.log(`  product bench skipped: ${error.message}`);
  }

  // Admin platform dashboard + overview
  const adminEmail = process.env.ADMIN_BOOTSTRAP_EMAIL;
  const adminPassword = process.env.ADMIN_BOOTSTRAP_PASSWORD;
  if (adminEmail && adminPassword) {
    try {
      const jar = await signIn(adminEmail, adminPassword);

      const dashRows = await sample(async () => {
        const { res, clientMs, serverMs } = await timedFetch(
          jar,
          "/api/admin/analytics/dashboard?range=7d"
        );
        if (!res.ok) throw new Error(`admin analytics ${res.status}`);
        return { clientMs, serverMs };
      }, SAMPLES);
      results.push(
        summarize("GET /api/admin/analytics/dashboard?range=7d", dashRows)
      );

      const overviewRows = await sample(async () => {
        const { res, clientMs, serverMs } = await timedFetch(
          jar,
          "/api/admin/overview"
        );
        if (!res.ok) throw new Error(`admin overview ${res.status}`);
        return { clientMs, serverMs };
      }, SAMPLES);
      results.push(summarize("GET /api/admin/overview", overviewRows));
    } catch (error) {
      console.log(`  admin bench skipped: ${error.message}`);
    }
  } else {
    console.log(
      "  skip admin (set ADMIN_BOOTSTRAP_EMAIL + ADMIN_BOOTSTRAP_PASSWORD)"
    );
  }

  console.log("\n--- paste into F02 Phase B baseline table ---");
  for (const r of results) {
    console.log(
      `| ${r.label} | ${r.clientP50 ?? "—"} | ${r.clientP95 ?? "—"} | ${r.serverP95 ?? "—"} | n=${r.n} |`
    );
  }
  console.log("\nF02-B bench done");
}

main().catch((error) => {
  console.error("F02-B bench FAILED:", error.message);
  process.exit(1);
});
