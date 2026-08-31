/**
 * F11 redesign deep integration — DB credential + policy + SSRF pin + demo execute.
 * Run: npm run test:f11r-deep
 * Requires DATABASE_URL + AUTH_SECRET (or ACTIONS_* keys).
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createHash, randomBytes } from "node:crypto";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");

function assert(ok, message) {
  if (!ok) throw new Error(message);
}

async function loadEnv() {
  const envPath = path.join(root, ".env");
  if (!fs.existsSync(envPath)) return;
  for (const line of fs.readFileSync(envPath, "utf8").split("\n")) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (!m || process.env[m[1]]) continue;
    let v = m[2];
    if (
      (v.startsWith('"') && v.endsWith('"')) ||
      (v.startsWith("'") && v.endsWith("'"))
    ) {
      v = v.slice(1, -1);
    }
    process.env[m[1]] = v;
  }
}

await loadEnv();
if (!process.env.ACTIONS_CREDENTIALS_KEY) {
  process.env.ACTIONS_CREDENTIALS_KEY =
    process.env.AUTH_SECRET || "dev-actions-credentials-key-32chars!!";
}
if (!process.env.ACTIONS_IDENTITY_SECRET) {
  process.env.ACTIONS_IDENTITY_SECRET =
    process.env.AUTH_SECRET || "dev-actions-identity-secret-32chars!!";
}

const { encryptSecret, decryptSecret } = await import("../lib/actions/secrets.js");
const {
  signCustomerIdentityToken,
  verifyCustomerIdentityToken,
  hashArgs,
} = await import("../lib/actions/identity.js");
const { evaluateActionPolicy } = await import("../lib/actions/policy.js");
const { assertActionUrlSafePinned, isBlockedHostname } = await import(
  "../lib/actions/ssrf.js"
);
const { assertFrozenHostMatch, extractFrozenHost } = await import(
  "../lib/actions/frozen-host.js"
);
const { executeHttpAction, resolveTemplate, MAX_RESPONSE_CHARS } = await import(
  "../lib/actions/http-executor.js"
);
const { shouldRetryHttpAction } = await import("../lib/actions/tool-errors.js");
const { applyCredentialToHeaders } = await import(
  "../lib/actions/credential-apply.js"
);

function testSecretsRoundtrip() {
  const plain = `sk_test_${randomBytes(16).toString("hex")}`;
  const ct = encryptSecret(plain);
  assert(ct.startsWith("v"), "ciphertext versioned");
  assert(!ct.includes(plain), "ciphertext hides plaintext");
  assert(decryptSecret(ct) === plain, "decrypt matches");
  console.log("ok  deep secrets roundtrip");
}

function testIdentitySubjectsIsolated() {
  const tA = signCustomerIdentityToken({
    sub: "user-a",
    exp: Math.floor(Date.now() / 1000) + 3600,
  });
  const tB = signCustomerIdentityToken({
    sub: "user-b",
    exp: Math.floor(Date.now() / 1000) + 3600,
  });
  assert(verifyCustomerIdentityToken(tA).sub === "user-a");
  assert(verifyCustomerIdentityToken(tB).sub === "user-b");
  assert(hashArgs({ orderId: "1" }) === hashArgs({ orderId: "1" }));
  assert(hashArgs({ a: 1, b: 2 }) === hashArgs({ b: 2, a: 1 }), "key order stable");
  console.log("ok  deep identity subjects");
}

function testPolicyGates() {
  const readOk = evaluateActionPolicy({
    action: { riskLevel: "READ", requiresIdentity: false },
    customerSubject: null,
  });
  assert(readOk.allow, "anonymous READ ok");

  const idDenied = evaluateActionPolicy({
    action: { riskLevel: "READ", requiresIdentity: true },
    customerSubject: null,
  });
  assert(!idDenied.allow && idDenied.code === "IDENTITY_REQUIRED");

  const writeDenied = evaluateActionPolicy({
    action: { riskLevel: "WRITE", requiresConfirmation: true },
    customerSubject: "u1",
    confirmationStatus: null,
  });
  assert(!writeDenied.allow && writeDenied.code === "CONFIRMATION_REQUIRED");

  const writeOk = evaluateActionPolicy({
    action: { riskLevel: "WRITE", requiresConfirmation: true },
    customerSubject: "u1",
    confirmationStatus: "APPROVED",
  });
  assert(writeOk.allow, "approved WRITE ok");
  console.log("ok  deep policy gates");
}

async function testSsrfPinBlocksPrivate() {
  assert(isBlockedHostname("169.254.169.254"));
  let blocked = false;
  try {
    await assertActionUrlSafePinned("https://169.254.169.254/latest/meta-data/");
  } catch (err) {
    blocked = err.code === "SSRF_BLOCKED";
  }
  assert(blocked, "metadata IP must be blocked by pin path");

  // Public DNS (example.com) should resolve to non-private
  const pinned = await assertActionUrlSafePinned("https://example.com/");
  assert(pinned.addresses?.length > 0, "example.com resolves");
  console.log("ok  deep SSRF DNS pin");
}

function testFrozenHostAndRetry() {
  assert(extractFrozenHost("https://api.example.com/x/{{id}}") === "api.example.com");
  let mismatch = false;
  try {
    assertFrozenHostMatch("https://evil.com/x", "api.example.com");
  } catch (err) {
    mismatch = err.code === "SSRF_BLOCKED";
  }
  assert(mismatch, "frozen host mismatch blocked");

  assert(
    shouldRetryHttpAction(
      { ok: false, status: "TIMEOUT", errorCode: "TIMEOUT" },
      { method: "GET", riskLevel: "READ" }
    ),
    "GET timeout retries"
  );
  assert(
    !shouldRetryHttpAction(
      { ok: false, status: "TIMEOUT", errorCode: "TIMEOUT" },
      { method: "POST", riskLevel: "WRITE", idempotent: false }
    ),
    "non-idempotent WRITE no blind retry"
  );
  assert(MAX_RESPONSE_CHARS === 8000);
  console.log("ok  deep frozen host + retry");
}

async function testDemoExecuteAndCredentialInject() {
  const cred = {
    id: "c1",
    name: "demo_key",
    type: "BEARER",
    headerName: null,
    plaintext: "super-secret-token-xyz",
    keyVersion: 1,
  };
  const headers = applyCredentialToHeaders(
    { Accept: "application/json", "X-Extra": "{{credential:demo_key}}" },
    cred,
    { credentialByName: { demo_key: cred } }
  );
  assert(headers.Authorization === "Bearer super-secret-token-xyz");
  assert(headers["X-Extra"] === "super-secret-token-xyz");
  assert(
    resolveTemplate("https://api.example.com/{{id}}", { id: "ORD-100" }).includes(
      "ORD-100"
    )
  );

  const result = await executeHttpAction({
    method: "GET",
    urlTemplate: "http://localhost:3000/api/demo/orders/{{orderId}}",
    headersJson: { Accept: "application/json" },
    args: { orderId: "ORD-100" },
    allowLocalDemo: true,
    frozenHost: "localhost",
    riskLevel: "READ",
  });
  assert(result.ok, `demo execute failed: ${result.errorCode} ${result.bodyText}`);
  assert(/Shipped/i.test(result.bodyText), "ORD-100 Shipped");
  assert(!JSON.stringify(result).includes("super-secret-token-xyz"), "no secret in result");
  console.log("ok  deep demo execute + credential inject");
}

async function testDbCredentialLifecycle() {
  if (!process.env.DATABASE_URL) {
    console.log("skip deep DB (no DATABASE_URL)");
    return;
  }

  const { Pool } = await import("pg");
  const { withVerifyFullSsl } = await import("../lib/pg-connection.js");
  const pool = new Pool({
    connectionString: withVerifyFullSsl(process.env.DATABASE_URL),
    max: 1,
  });

  try {
    const ws = await pool.query(
      `SELECT id FROM "Workspace" ORDER BY "createdAt" ASC LIMIT 1`
    );
    if (!ws.rows[0]) {
      console.log("skip deep DB (no workspace row)");
      return;
    }
    const workspaceId = ws.rows[0].id;
    const id = `cred_${randomBytes(8).toString("hex")}`;
    const name = `t_cred_${createHash("sha1").update(id).digest("hex").slice(0, 8)}`;
    const secret = `tok_${randomBytes(12).toString("hex")}`;
    const ciphertext = encryptSecret(secret);

    await pool.query(
      `INSERT INTO "ActionCredential"
        (id, "workspaceId", name, type, ciphertext, "keyVersion", "createdAt", "updatedAt")
       VALUES ($1, $2, $3, 'BEARER', $4, 1, NOW(), NOW())`,
      [id, workspaceId, name, ciphertext]
    );

    const row = await pool.query(
      `SELECT ciphertext, "revokedAt" FROM "ActionCredential" WHERE id = $1`,
      [id]
    );
    assert(row.rows[0].ciphertext !== secret, "DB stores ciphertext");
    assert(decryptSecret(row.rows[0].ciphertext) === secret);

    await pool.query(
      `UPDATE "ActionCredential" SET "revokedAt" = NOW(), "updatedAt" = NOW() WHERE id = $1`,
      [id]
    );
    const revoked = await pool.query(
      `SELECT "revokedAt" FROM "ActionCredential" WHERE id = $1`,
      [id]
    );
    assert(revoked.rows[0].revokedAt, "revokedAt set");

    await pool.query(`DELETE FROM "ActionCredential" WHERE id = $1`, [id]);
    console.log("ok  deep DB credential lifecycle");
  } finally {
    await pool.end();
  }
}

async function main() {
  testSecretsRoundtrip();
  testIdentitySubjectsIsolated();
  testPolicyGates();
  await testSsrfPinBlocksPrivate();
  testFrozenHostAndRetry();
  await testDemoExecuteAndCredentialInject();
  await testDbCredentialLifecycle();
  console.log("\nF11 redesign deep integration passed");
}

main().catch((err) => {
  console.error("FAIL", err);
  process.exit(1);
});
