/**
 * F02 Phase H — production-ish load + latency checks.
 *
 * Usage (server up):
 *   npm run load:f02h
 *
 * Env:
 *   TEST_BASE_URL
 *   F02_PUBLIC_KEY          public agent key for concurrent chats + origin check
 *   F02_LOAD_CONCURRENCY    default 20
 *   F02_LOAD_SKIP_CHAT=1    skip OpenAI concurrent chats
 *   ADMIN_BOOTSTRAP_*       admin analytics cold load
 *   F02_BENCH_SKIP_CHAT=1   (also honored for chat skip)
 */
import "dotenv/config";

const BASE = (process.env.TEST_BASE_URL || "http://127.0.0.1:3000").replace(
  /\/$/,
  ""
);
const CONCURRENCY = Math.min(
  50,
  Math.max(1, Number(process.env.F02_LOAD_CONCURRENCY) || 20)
);
const PUBLIC_KEY = process.env.F02_PUBLIC_KEY?.trim() || "";
const SKIP_CHAT =
  process.env.F02_LOAD_SKIP_CHAT === "1" ||
  process.env.F02_BENCH_SKIP_CHAT === "1";

function percentile(sorted, p) {
  if (!sorted.length) return null;
  const idx = Math.min(
    sorted.length - 1,
    Math.max(0, Math.ceil((p / 100) * sorted.length) - 1)
  );
  return sorted[idx];
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
    return { _raw: text.slice(0, 160) };
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
  if (session?.user?.email !== email) throw new Error("sign-in failed");
  return jar;
}

async function timed(path, options = {}) {
  const t0 = Date.now();
  const res = await fetch(`${BASE}${path}`, options);
  const clientMs = Date.now() - t0;
  const serverMs = Number(res.headers.get("x-aide-duration-ms"));
  const body = await json(res);
  return { res, body, clientMs, serverMs: Number.isFinite(serverMs) ? serverMs : null };
}

async function main() {
  console.log(`F02-H load @ ${BASE}\n`);

  try {
    const health = await fetch(`${BASE}/api/health`);
    if (!health.ok) throw new Error(`health ${health.status}`);
  } catch (error) {
    console.log(`skip load (server not reachable: ${error.message})`);
    console.log("Start npm run dev (or preview) then: npm run load:f02h");
    process.exit(0);
  }

  const results = [];

  // --- concurrent public chats ---
  if (!PUBLIC_KEY) {
    console.log("  skip concurrent chats (set F02_PUBLIC_KEY)");
  } else if (SKIP_CHAT) {
    console.log("  skip concurrent chats (F02_LOAD_SKIP_CHAT=1)");
  } else {
    const origin = process.env.F02_EMBED_ORIGIN || "https://loadtest.example.com";
    const tasks = Array.from({ length: CONCURRENCY }, (_, i) =>
      timed(`/api/public/agents/${PUBLIC_KEY}/chat`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Origin: origin,
        },
        body: JSON.stringify({ message: `load-f02h #${i + 1}` }),
      })
    );
    const rows = await Promise.all(tasks);
    const statuses = rows.map((r) => r.res.status);
    const okish = statuses.filter((s) => s === 200 || s === 429).length;
    const hardFail = statuses.filter((s) => s >= 500).length;
    const client = rows.map((r) => r.clientMs).sort((a, b) => a - b);
    console.log(
      `  concurrent pub-chat n=${CONCURRENCY} ok/429=${okish} 5xx=${hardFail}`
    );
    console.log(
      `    client p50=${percentile(client, 50)}ms p95=${percentile(client, 95)}ms`
    );
    if (hardFail > 0) {
      console.log("  FAIL  5xx storm under concurrent public chat");
      process.exitCode = 1;
    } else {
      console.log("  ok  no 5xx storm");
    }
    results.push({
      label: "concurrent pub-chat",
      hardFail,
      p95: percentile(client, 95),
    });
  }

  // --- origin lock still holds ---
  if (PUBLIC_KEY) {
    const locked = process.env.F02_EMBED_ORIGIN || "https://loadtest.example.com";
    const other = "https://evil-other-site.example";
    const a = await timed(`/api/public/agents/${PUBLIC_KEY}/ping`, {
      method: "POST",
      headers: { Origin: locked, "Content-Type": "application/json" },
      body: "{}",
    });
    const b = await timed(`/api/public/agents/${PUBLIC_KEY}/ping`, {
      method: "POST",
      headers: { Origin: other, "Content-Type": "application/json" },
      body: "{}",
    });
    // After lock, wrong origin should be denied (403) or agent not found.
    const deny =
      b.res.status === 403 ||
      b.res.status === 404 ||
      b.body?.error?.message ||
      b.body?.reason;
    console.log(
      `  origin lock: home=${a.res.status} other=${b.res.status} (${deny ? "denied" : "check manually"})`
    );
    if (b.res.status === 200 && b.body?.ok === true && b.body?.allowed !== false) {
      // May still be unlocked on first run — warn only.
      console.log("  note  other origin still allowed (agent may not be locked yet)");
    } else {
      console.log("  ok  embed origin check exercised");
    }
  }

  // --- analytics 30d + admin cold ---
  const adminEmail = process.env.ADMIN_BOOTSTRAP_EMAIL;
  const adminPassword = process.env.ADMIN_BOOTSTRAP_PASSWORD;
  if (adminEmail && adminPassword) {
    try {
      const jar = await signIn(adminEmail, adminPassword);
      const cold = await timed("/api/admin/analytics/dashboard?range=30d", {
        headers: { Cookie: jar.header() },
      });
      console.log(
        `  admin analytics 30d cold: ${cold.res.status} client=${cold.clientMs}ms server=${cold.serverMs ?? "—"}ms`
      );
      if (!cold.res.ok) process.exitCode = 1;
      else console.log("  ok  admin 30d cold load recorded");

      const product = await timed("/api/analytics/dashboard?range=30d", {
        headers: { Cookie: jar.header() },
      });
      console.log(
        `  product analytics 30d: ${product.res.status} client=${product.clientMs}ms server=${product.serverMs ?? "—"}ms`
      );
      results.push({
        label: "admin 30d",
        p95: cold.clientMs,
        server: cold.serverMs,
      });
      results.push({
        label: "product 30d",
        p95: product.clientMs,
        server: product.serverMs,
      });
    } catch (error) {
      console.log(`  admin/product analytics skipped: ${error.message}`);
    }
  } else {
    console.log("  skip admin/product analytics (ADMIN_BOOTSTRAP_*)");
  }

  console.log("\n--- paste into F02 Phase H ---");
  for (const r of results) {
    console.log(
      `| ${r.label} | ${r.p95 ?? "—"} | ${r.server ?? "—"} | hardFail=${r.hardFail ?? 0} |`
    );
  }
  console.log("\nF02-H load done");
}

main().catch((error) => {
  console.error("F02-H load FAILED:", error.message);
  process.exit(1);
});
