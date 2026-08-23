/**
 * F01 Phase B smoke — public error shape + x-request-id, admin 401 request-id.
 * Run: npm run test:f01b  (optional live checks need npm run dev or TEST_BASE_URL)
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const BASE = (process.env.TEST_BASE_URL || "http://127.0.0.1:3000").replace(
  /\/$/,
  ""
);

function assert(ok, message) {
  if (!ok) throw new Error(message);
}

function read(rel) {
  return fs.readFileSync(path.join(root, rel), "utf8");
}

async function json(res) {
  const text = await res.text();
  try {
    return text ? JSON.parse(text) : null;
  } catch {
    return { _raw: text.slice(0, 240) };
  }
}

function testSourceContracts() {
  const ping = read("app/api/public/agents/[publicKey]/ping/route.js");
  assert(/jsonError/.test(ping), "ping must use jsonError");
  assert(/resolveRequestId/.test(ping), "ping must resolve request id");

  const files = read("app/api/public/agents/[publicKey]/files/route.js");
  assert(/jsonError/.test(files), "files must use jsonError");

  const requireAdmin = read("lib/require-admin.js");
  assert(/jsonError/.test(requireAdmin), "requireAdmin must use jsonError");

  console.log("ok  Phase B source contracts");
}

async function testLiveHttp() {
  let health;
  try {
    health = await fetch(`${BASE}/api/health`);
  } catch {
    console.log("skip live HTTP (server not reachable at", BASE + ")");
    return;
  }
  if (!health.ok) {
    console.log("skip live HTTP (health not ok)");
    return;
  }

  const rid = `f01b-${Date.now()}`;

  const ping = await fetch(
    `${BASE}/api/public/agents/does-not-exist-key/ping`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-request-id": `${rid}-ping`,
      },
      body: "{}",
    }
  );
  const pingBody = await json(ping);
  assert(ping.status === 404, `ping expected 404 got ${ping.status}`);
  assert(
    ping.headers.get("x-request-id") === `${rid}-ping`,
    "ping should echo x-request-id"
  );
  assert(
    pingBody?.error?.message === "Agent not found",
    "ping 404 must use { error: { message } }"
  );
  assert(
    pingBody?.ok !== true,
    "ping 404 must not look like success { ok: true }"
  );
  console.log("ok  public ping 404 error shape + x-request-id");

  const files = await fetch(
    `${BASE}/api/public/agents/does-not-exist-key/files`,
    {
      method: "POST",
      headers: { "x-request-id": `${rid}-files` },
    }
  );
  const filesBody = await json(files);
  assert(files.status === 404, `files expected 404 got ${files.status}`);
  assert(
    files.headers.get("x-request-id") === `${rid}-files`,
    "files should echo x-request-id"
  );
  assert(filesBody?.error?.message, "files error.message required");
  console.log("ok  public files 404 + x-request-id");

  const admin = await fetch(`${BASE}/api/admin/overview`, {
    headers: { "x-request-id": `${rid}-admin` },
  });
  const adminBody = await json(admin);
  assert(admin.status === 401, `admin expected 401 got ${admin.status}`);
  assert(
    admin.headers.get("x-request-id") === `${rid}-admin`,
    "admin 401 should echo x-request-id"
  );
  assert(adminBody?.error?.message, "admin error.message required");
  console.log("ok  admin overview 401 + x-request-id");
}

async function main() {
  testSourceContracts();
  await testLiveHttp();
  console.log("\nF01-B smoke passed");
}

main().catch((error) => {
  console.error("\nF01-B smoke FAILED:", error.message);
  process.exit(1);
});
