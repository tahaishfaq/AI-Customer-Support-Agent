import fs from "node:fs";
import path from "node:path";
import process from "node:process";

const root = process.cwd();
const adrPath = path.join(root, "docs/decisions/002-realtime-architecture.md");
const envPath = path.join(root, "docs/features/REALTIME_ENVIRONMENT_CONTRACT.md");
const planPath = path.join(root, "docs/features/SOCKET_REALTIME_PLAN.md");

function read(file) {
  return fs.readFileSync(file, "utf8");
}

function assert(condition, message) {
  if (!condition) throw new Error(`Phase 0 contract failure: ${message}`);
}

const adr = read(adrPath);
const env = read(envPath);
const plan = read(planPath);

assert(adr.includes("PostgreSQL is authoritative"), "PostgreSQL authority is missing");
assert(adr.includes("Socket handlers never create, update, claim, resolve, bill"), "socket mutation invariant is missing");
assert(adr.includes("realtimeSessionId"), "owner multi-device session claim is missing");
assert(adr.includes("customerSubjectHash"), "public subject binding claim is missing");
assert(adr.includes("public key and conversation ID alone are not sufficient"), "public capability boundary is missing");

for (const room of [
  "user:{userId}",
  "workspace:{workspaceId}:desk",
  "conversation:{conversationId}:owner",
  "conversation:{conversationId}:public",
]) {
  assert(adr.includes(room), `room ACL missing: ${room}`);
}

for (const event of [
  "conversation.handoff.created",
  "conversation.message.created",
  "workspace.inbox-seen.updated",
  "billing.subscription.updated",
  "access.revoked",
]) {
  assert(adr.includes(event), `event contract missing: ${event}`);
}

for (const mutation of [
  "Handoff",
  "Human reply",
  "Internal note",
  "Claim/release",
  "Resolve",
  "Priority",
  "CSAT",
  "Inbox seen",
  "Billing webhook",
]) {
  assert(adr.includes(`| ${mutation} |`), `transaction boundary missing: ${mutation}`);
}

for (const variable of [
  "REALTIME_ENABLED",
  "REALTIME_URL",
  "REALTIME_TOKEN_SECRET",
  "REALTIME_REDIS_URL",
  "REALTIME_STREAM_NAME",
  "REALTIME_DLQ_STREAM_NAME",
  "REALTIME_CONSUMER_GROUP",
  "REALTIME_MAX_CONNECTIONS",
]) {
  assert(env.includes(`| \`${variable}\` |`), `environment contract missing: ${variable}`);
}

assert(env.includes("No Redis credentials in source"), "secret handling rule is missing");
assert(env.includes("No wildcard production CORS/origin policy"), "origin security rule is missing");
assert(plan.includes("Mandatory test gate after Phase 0"), "Phase 0 test gate is missing from the plan");
assert(!/REALTIME_(?:TOKEN_SECRET|REDIS_PASSWORD)\s*=\s*[^`\s|]+/i.test(env), "an environment secret value appears in the contract");

console.log("Realtime Phase 0 contract checks passed.");
