/**
 * Full-suite: Aide HTTP agent actions → Brandly (FYP) live API on :8000.
 *
 * Reproduces the common failure (no X-API-KEY → 401) and verifies success
 * when BRANDLY_API_KEY is set.
 *
 * Run (Brandly API must be up on :8000):
 *   BRANDLY_API_KEY=brnd_live_… npm run test:brandly-http
 *
 * Optional:
 *   BRANDLY_API_BASE=http://127.0.0.1:8000/api/v1
 */
import { applyCredentialToHeaders } from "../lib/actions/credential-apply.js";
import { executeHttpAction } from "../lib/actions/http-executor.js";
import { evaluateActionPolicy } from "../lib/actions/policy.js";
import { resolveIdentityMode } from "../lib/actions/identity-mode.js";
import { safeToolErrorMessage } from "../lib/actions/tool-errors.js";
import { assertActionUrlSafe } from "../lib/actions/ssrf.js";

const BASE =
  process.env.BRANDLY_API_BASE || "http://127.0.0.1:8000/api/v1";
const API_KEY = String(process.env.BRANDLY_API_KEY || "").trim();

function assert(ok, message) {
  if (!ok) throw new Error(message);
}

async function ping() {
  const res = await fetch(`${BASE.replace(/\/api\/v1$/, "")}/api/v1/ping`);
  assert(res.ok, `Brandly ping failed (${res.status}) — start brandy-backend on :8000`);
  console.log("ok  Brandly ping");
}

async function testDirectNoKey() {
  const res = await fetch(`${BASE}/campaigns/?limit=1`);
  assert(res.status === 401, `expected 401 without key, got ${res.status}`);
  console.log("ok  direct call without X-API-KEY → 401 (reproduces your auth error)");
}

async function testDirectWithKey() {
  if (!API_KEY) {
    console.log("skip direct+key (set BRANDLY_API_KEY to exercise live success)");
    return null;
  }
  const res = await fetch(`${BASE}/campaigns/?search=&limit=3`, {
    headers: { "X-API-KEY": API_KEY },
  });
  const text = await res.text();
  assert(res.ok, `Brandly with key failed ${res.status}: ${text.slice(0, 200)}`);
  console.log("ok  direct call with X-API-KEY →", res.status);
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

async function testExecutorNoCredential() {
  const result = await executeHttpAction({
    method: "GET",
    urlTemplate: `${BASE}/campaigns?search={{query}}&limit=5`,
    args: { query: "a" },
    timeoutMs: 8000,
    allowLocalDemo: true,
    credential: null,
    frozenHost: "127.0.0.1",
    riskLevel: "READ",
  });
  assert(!result.ok, "expected failure without credential");
  assert(
    result.httpStatus === 401 || result.errorCode === "HTTP_401" || /401/.test(String(result.errorCode)),
    `expected 401 from executor, got status=${result.status} http=${result.httpStatus} code=${result.errorCode}`
  );
  const msg = safeToolErrorMessage(result);
  assert(/401|API-key|X-API-KEY|Unauthorized/i.test(msg), `helpful 401 copy: ${msg}`);
  console.log("ok  Aide executor without credential → 401 + helpful message");
}

async function testExecutorWithCredential() {
  if (!API_KEY) {
    console.log("skip executor+key (set BRANDLY_API_KEY)");
    return;
  }
  const credential = {
    name: "brandly_agent",
    type: "API_KEY_HEADER",
    headerName: "X-API-KEY",
    plaintext: API_KEY,
  };
  const headers = applyCredentialToHeaders({}, credential);
  assert(headers["X-API-KEY"] === API_KEY, "X-API-KEY applied");

  const result = await executeHttpAction({
    method: "GET",
    urlTemplate: `${BASE}/campaigns?search={{query}}&limit=5`,
    args: { query: "" },
    timeoutMs: 12000,
    allowLocalDemo: true,
    credential,
    frozenHost: "127.0.0.1",
    riskLevel: "READ",
    identityMode: "OWNER_KEY",
  });
  assert(
    result.ok,
    `executor+key failed: ${result.errorCode} http=${result.httpStatus} ${String(result.bodyText || "").slice(0, 180)}`
  );
  console.log("ok  Aide executor with OWNER_KEY X-API-KEY →", result.httpStatus, `${result.durationMs}ms`);
}

async function testSsrfLocalAllowed() {
  assertActionUrlSafe(`${BASE}/campaigns`, { allowLocalDemo: true });
  let blocked = false;
  try {
    assertActionUrlSafe(`${BASE}/campaigns`, { allowLocalDemo: false });
  } catch (err) {
    blocked = err?.code === "SSRF_BLOCKED";
  }
  assert(blocked, "localhost blocked when allowLocalDemo=false");
  console.log("ok  SSRF: localhost allowed only with allowLocalDemo");
}

function testIdentityModes() {
  const publicPolicy = evaluateActionPolicy({
    action: { identityMode: "OWNER_KEY", riskLevel: "READ" },
  });
  assert(publicPolicy.allow, "OWNER_KEY anonymous OK");

  const privateDeny = evaluateActionPolicy({
    action: { identityMode: "END_USER_TOKEN", riskLevel: "READ" },
    customerSubject: null,
  });
  assert(privateDeny.code === "IDENTITY_REQUIRED", "END_USER_TOKEN needs login");

  const privateNeedTok = evaluateActionPolicy({
    action: { identityMode: "END_USER_TOKEN", riskLevel: "READ" },
    customerSubject: "user_1",
    endUserAccessToken: null,
  });
  assert(
    privateNeedTok.code === "END_USER_TOKEN_REQUIRED",
    "END_USER_TOKEN needs accessToken"
  );

  assert(resolveIdentityMode({ identityMode: "OWNER_KEY" }) === "OWNER_KEY");
  console.log("ok  identity modes: public=OWNER_KEY · private=END_USER_TOKEN");
}

function printSetupHint() {
  console.log(`
────────────────────────────────────────────────────────
SETUP (fixes your live-system auth error)
1. Brandly: login → create API key (scopes: campaigns:read, …)
2. Aide → agent → Tools → Auth / credential:
     type: API_KEY_HEADER
     header: X-API-KEY
     secret: brnd_live_…
3. Attach that credential to list_brandly_campaigns + get_brandly_campaign
4. identityMode: OWNER_KEY (or NONE + credential) for public reads
5. For private "my …" tools: END_USER_TOKEN + embed aideChat.setUser({ accessToken })
6. Run Aide + Brandly on the SAME machine (127.0.0.1). Cloud Aide cannot reach your laptop :8000.
────────────────────────────────────────────────────────`);
}

async function main() {
  console.log("Brandly HTTP agent-action suite\n");
  await ping();
  testIdentityModes();
  await testSsrfLocalAllowed();
  await testDirectNoKey();
  await testExecutorNoCredential();
  await testDirectWithKey();
  await testExecutorWithCredential();
  printSetupHint();
  if (!API_KEY) {
    console.log("\nPARTIAL PASS — reproduced 401; re-run with BRANDLY_API_KEY=… for full green");
    process.exit(0);
  }
  console.log("\nBrandly HTTP suite passed");
}

main().catch((err) => {
  console.error("\nBrandly HTTP suite FAILED:", err.message);
  process.exit(1);
});
