/**
 * Production / local env preflight (AIDE-GAP-008).
 * Never prints secret values — only PRESENT / MISSING / INVALID.
 *
 * Usage:
 *   node scripts/production-preflight.js
 *   node scripts/production-preflight.js --production
 */

require("dotenv/config");

const mode = process.argv.includes("--production") ? "production" : "local";

const rows = [];
const failures = [];
const warnings = [];
const externalBlocked = [];

function value(name) {
  return String(process.env[name] || "").trim();
}

function isPlaceholder(input) {
  return /^(change[-_ ]?me|your[-_ ]|example|replace[-_ ]|todo|xxx|sk-xxx)/i.test(
    input
  );
}

function isLocalhostUrl(input) {
  try {
    const u = new URL(input);
    return (
      u.hostname === "localhost" ||
      u.hostname === "127.0.0.1" ||
      u.hostname === "::1"
    );
  } catch {
    return false;
  }
}

function record(name, status, note = "") {
  rows.push({ name, status, note });
  if (status === "MISSING" || status === "INVALID") {
    failures.push(`${name}: ${status}${note ? ` (${note})` : ""}`);
  }
}

function checkPresent(name, { https = false, productionNoLocalhost = false } = {}) {
  const current = value(name);
  if (!current) {
    record(name, "MISSING");
    return;
  }
  if (isPlaceholder(current)) {
    record(name, "INVALID", "placeholder");
    return;
  }
  if (https && !/^https:\/\//i.test(current)) {
    record(name, "INVALID", "must be https");
    return;
  }
  if (productionNoLocalhost && isLocalhostUrl(current)) {
    record(name, "INVALID", "localhost not allowed in production");
    return;
  }
  record(name, "PRESENT");
}

function checkOptionalHttps(name) {
  const current = value(name);
  if (!current) {
    record(name, "MISSING", "optional");
    return;
  }
  if (!/^https:\/\//i.test(current)) {
    record(name, "INVALID", "must be https when set");
    return;
  }
  record(name, "PRESENT");
}

function checkActionsCredentialsKey() {
  const name = "ACTIONS_CREDENTIALS_KEY";
  const current = value(name);
  if (!current || isPlaceholder(current)) {
    record(name, current ? "INVALID" : "MISSING", current ? "placeholder" : "");
    return;
  }
  // Prefer 32+ byte material (hex 64 or raw 32+)
  const hexOk = /^[a-f0-9]{64}$/i.test(current);
  const longOk = current.length >= 32;
  if (!hexOk && !longOk) {
    record(name, "INVALID", "too short / not 32-byte hex");
    return;
  }
  record(name, "PRESENT");
}

function checkAuthSecret() {
  const name = "AUTH_SECRET";
  const current = value(name);
  if (!current || isPlaceholder(current)) {
    record(name, current ? "INVALID" : "MISSING");
    return;
  }
  if (current.length < 32) {
    record(name, "INVALID", "length < 32");
    return;
  }
  record(name, "PRESENT");
}

// Always required presence checks
checkPresent("DATABASE_URL");
checkAuthSecret();
checkPresent("AUTH_URL", {
  https: mode === "production",
  productionNoLocalhost: mode === "production",
});
checkPresent("NEXT_PUBLIC_APP_URL", {
  https: mode === "production",
  productionNoLocalhost: mode === "production",
});
checkPresent("OPENAI_API_KEY");

if (mode === "production") {
  checkPresent("ACTIONS_IDENTITY_SECRET");
  checkActionsCredentialsKey();
  checkPresent("SAFEPAY_API_KEY");
  checkPresent("SAFEPAY_WEBHOOK_SECRET");
  checkPresent("RESEND_API_KEY");
  checkPresent("REALTIME_REDIS_URL");
  checkPresent("REALTIME_TOKEN_SECRET");

  const redisEnabled = value("REDIS_ENABLED");
  if (!/^(1|true|yes)$/i.test(redisEnabled)) {
    record("REDIS_ENABLED", "INVALID", "must be 1/true in production");
  } else {
    record("REDIS_ENABLED", "PRESENT");
  }
  const redisUrl = value("REDIS_URL") || value("REALTIME_REDIS_URL");
  if (!redisUrl || isPlaceholder(redisUrl)) {
    record("REDIS_URL|REALTIME_REDIS_URL", "MISSING");
  } else {
    record("REDIS_URL|REALTIME_REDIS_URL", "PRESENT");
  }

  if (!value("DIRECT_URL")) {
    warnings.push("DIRECT_URL is missing; migrations will use DATABASE_URL");
    record("DIRECT_URL", "MISSING", "warn only");
  } else {
    record("DIRECT_URL", "PRESENT");
  }

  if (value("OPENAI_WEB_SEARCH_ENABLED").toLowerCase() !== "true") {
    warnings.push("OPENAI_WEB_SEARCH_ENABLED is not true; hosted web search remains disabled");
  }

  checkOptionalHttps("REALTIME_URL");

  externalBlocked.push(
    "OpenAI live credits / billing — manual",
    "SafePay live webhook delivery — manual",
    "Resend live send/inbound — manual",
    "Production embed ping + origin lock on real site — manual",
    "Production WRITE confirmation UI smoke — manual",
    "Owner unconditional PRODUCTION READY = YES — manual"
  );
} else {
  if (value("AUTH_URL") && !/^https?:\/\//i.test(value("AUTH_URL"))) {
    record("AUTH_URL", "INVALID", "must be http(s) URL");
  }
  if (
    value("NEXT_PUBLIC_APP_URL") &&
    !/^https?:\/\//i.test(value("NEXT_PUBLIC_APP_URL"))
  ) {
    record("NEXT_PUBLIC_APP_URL", "INVALID", "must be http(s) URL");
  }
}

console.log(`Production preflight (${mode})`);
console.log("---");
for (const row of rows) {
  const note = row.note ? ` ${row.note}` : "";
  console.log(`${row.status.padEnd(8)} ${row.name}${note}`);
}
for (const warning of warnings) console.log(`WARN     ${warning}`);
if (externalBlocked.length) {
  console.log("---");
  console.log("EXTERNAL_BLOCKED (cannot verify from this repo alone):");
  for (const item of externalBlocked) console.log(`  - ${item}`);
}
console.log("---");
if (failures.length) {
  console.log(`Preflight failed: ${failures.length} check(s)`);
  process.exitCode = 1;
} else {
  console.log("Preflight passed (code-owned checks)");
}
