/**
 * F11 redesign R1 smoke — secrets encrypt, schema credential, resolveTemplate, redact.
 * Run: npm run test:f11r1
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { encryptSecret, decryptSecret } from "../lib/actions/secrets.js";
import { resolveTemplate } from "../lib/actions/http-executor.js";
import {
  redactHeadersJsonForUi,
  SECRET_REDACT_PLACEHOLDER,
  serializeActionForOwner,
} from "../lib/actions/action-config.js";
import { applyCredentialToHeaders } from "../lib/actions/credential-apply.js";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");

function assert(ok, message) {
  if (!ok) throw new Error(message);
}

function read(rel) {
  return fs.readFileSync(path.join(root, rel), "utf8");
}

function exists(rel) {
  return fs.existsSync(path.join(root, rel));
}

function testFilesExist() {
  const files = [
    "lib/actions/secrets.js",
    "lib/services/credential.service.js",
    "lib/actions/frozen-host.js",
    "prisma/migrations/20260824230000_f11r_actions_redesign/migration.sql",
  ];
  for (const f of files) assert(exists(f), `missing ${f}`);
  console.log("ok  R1 files exist");
}

function testEncryptRoundtrip() {
  process.env.ACTIONS_CREDENTIALS_KEY =
    process.env.ACTIONS_CREDENTIALS_KEY || "test-credentials-key-32chars-min!!";
  const plain = "sk-live-super-secret-value";
  const cipher = encryptSecret(plain);
  assert(cipher.includes("."), "ciphertext format");
  assert(!cipher.includes(plain), "ciphertext hides plaintext");
  assert(decryptSecret(cipher) === plain, "decrypt roundtrip");
  console.log("ok  encrypt/decrypt roundtrip");
}

function testSchemaHasCredential() {
  const schema = read("prisma/schema.prisma");
  assert(/model ActionCredential/.test(schema), "ActionCredential model");
  assert(/credentialId/.test(schema), "AgentAction.credentialId");
  console.log("ok  schema ActionCredential");
}

function testResolveCredentialTemplate() {
  const url = resolveTemplate(
    "https://api.example.com/x?k={{credential:shop_key}}",
    {},
    {
      encode: true,
      credentialByName: { shop_key: { plaintext: "abc123" } },
    }
  );
  assert(url.includes("abc123"), "credential template resolved");
  console.log("ok  resolveTemplate credential");
}

function testRedactNeverPlaintext() {
  const headers = redactHeadersJsonForUi({
    Authorization: "Bearer {{credential:shop_key}}",
  });
  assert(
    String(headers.Authorization).includes(SECRET_REDACT_PLACEHOLDER),
    "redact credential ref"
  );
  assert(
    !String(JSON.stringify(headers)).includes("shop_key"),
    "never show credential name after redact pattern"
  );

  const applied = applyCredentialToHeaders(
    { Authorization: "Bearer {{credential:shop}}" },
    null,
    { credentialByName: { shop: { plaintext: "PLAINTEXT_SECRET_XYZ" } } }
  );
  assert(applied.Authorization.includes("PLAINTEXT_SECRET_XYZ"));

  const serialized = serializeActionForOwner({
    id: "1",
    agentId: "a",
    name: "t",
    description: "d",
    method: "GET",
    urlTemplate: "https://api.example.com/x",
    headersJson: { Authorization: "Bearer {{credential:shop}}" },
    enabled: true,
    timeoutMs: 8000,
  });
  assert(
    !JSON.stringify(serialized).includes("PLAINTEXT"),
    "serialize never expands plaintext"
  );
  console.log("ok  redact never shows plaintext");
}

function main() {
  testFilesExist();
  testEncryptRoundtrip();
  testSchemaHasCredential();
  testResolveCredentialTemplate();
  testRedactNeverPlaintext();
  console.log("\nF11-R1 smoke passed");
}

try {
  main();
} catch (error) {
  console.error("\nF11-R1 smoke FAILED:", error.message);
  process.exit(1);
}
