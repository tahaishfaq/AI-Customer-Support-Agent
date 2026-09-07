require("dotenv/config");

const mode = process.argv.includes("--production") ? "production" : "local";

const required = [
  "DATABASE_URL",
  "AUTH_SECRET",
  "AUTH_URL",
  "NEXT_PUBLIC_APP_URL",
  "OPENAI_API_KEY",
  "REALTIME_REDIS_URL",
  "REALTIME_TOKEN_SECRET",
];

const productionRequired = [
  "ACTIONS_IDENTITY_SECRET",
  "ACTIONS_CREDENTIALS_KEY",
  "SAFEPAY_API_KEY",
  "SAFEPAY_WEBHOOK_SECRET",
  "RESEND_API_KEY",
];

const failures = [];
const warnings = [];

function value(name) {
  return String(process.env[name] || "").trim();
}

function isPlaceholder(input) {
  return /^(change[-_ ]?me|your[-_ ]|example|replace[-_ ]|todo|xxx)/i.test(input);
}

function requireValue(name) {
  const current = value(name);
  if (!current || isPlaceholder(current)) failures.push(`${name} is missing or placeholder`);
}

function requireHttps(name) {
  const current = value(name);
  if (!/^https:\/\//i.test(current)) failures.push(`${name} must use HTTPS in production`);
}

for (const name of required) requireValue(name);

if (mode === "production") {
  for (const name of productionRequired) requireValue(name);
  requireHttps("AUTH_URL");
  requireHttps("NEXT_PUBLIC_APP_URL");
  if (!value("DIRECT_URL")) warnings.push("DIRECT_URL is missing; migrations will use DATABASE_URL");
  if (value("OPENAI_WEB_SEARCH_ENABLED").toLowerCase() !== "true") {
    warnings.push("OPENAI_WEB_SEARCH_ENABLED is not true; hosted web search remains disabled");
  }
  if (value("REALTIME_URL") && !/^https:\/\//i.test(value("REALTIME_URL"))) {
    failures.push("REALTIME_URL must use HTTPS in production");
  }
} else {
  if (value("AUTH_URL") && !/^https?:\/\//i.test(value("AUTH_URL"))) {
    failures.push("AUTH_URL must be a valid HTTP(S) URL");
  }
  if (value("NEXT_PUBLIC_APP_URL") && !/^https?:\/\//i.test(value("NEXT_PUBLIC_APP_URL"))) {
    failures.push("NEXT_PUBLIC_APP_URL must be a valid HTTP(S) URL");
  }
}

console.log(`Production preflight (${mode})`);
console.log(`Checked ${required.length + (mode === "production" ? productionRequired.length : 0)} required variables`);
for (const warning of warnings) console.log(`WARN  ${warning}`);
for (const failure of failures) console.log(`FAIL  ${failure}`);

if (failures.length) {
  console.log(`\nPreflight failed: ${failures.length} check(s)`);
  process.exitCode = 1;
} else {
  console.log("\nPreflight passed");
}
