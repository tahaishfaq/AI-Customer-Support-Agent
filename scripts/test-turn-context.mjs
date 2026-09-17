/**
 * Task 6 — buildAgentTurnContext extracted from chat.service; trust order unchanged.
 * Run: npm run test:turn-context
 *
 * Avoid importing turn-context.js (Prisma / @/ aliases). Assert via source + local language helpers.
 */
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");

function read(rel) {
  return fs.readFileSync(path.join(root, rel), "utf8");
}

/** Mirror of turn-context detectTextLanguage for contract smoke (keep in sync). */
function detectTextLanguage(text) {
  const sample = String(text || "").slice(0, 4000);
  if (!sample.trim()) return "english";
  const arabicScript = (sample.match(/[\u0600-\u06FF]/g) || []).length;
  const letters = (sample.match(/[A-Za-z\u0600-\u06FF]/g) || []).length || 1;
  if (arabicScript / letters >= 0.25) return "urdu";
  return "english";
}

function testLanguageContractInSource() {
  const ctx = read("lib/services/ai/turn-context.js");
  assert.match(ctx, /export function detectKnowledgeLanguage/);
  assert.match(ctx, /export function detectTextLanguage/);
  assert.match(ctx, /MAX_HISTORY_MESSAGES = 20/);
  assert.equal(detectTextLanguage(""), "english");
  assert.equal(detectTextLanguage("What is your return policy?"), "english");
  console.log("ok  language helpers + history bound");
}

function testModuleExportsAndOrder() {
  const ctx = read("lib/services/ai/turn-context.js");
  assert.match(ctx, /export async function buildAgentTurnContext/);
  assert.match(ctx, /selectKnowledgeChunks/);
  assert.match(ctx, /routeSource/);
  assert.match(ctx, /decidePublicEvidence/);
  assert.match(ctx, /buildChatSystemPrompt/);
  assert.match(ctx, /filterCapabilitiesForSourceRoute/);
  assert.match(ctx, /listEnabledActionsForAgent/);
  assert.doesNotMatch(ctx, /runTurn\(/);
  assert.doesNotMatch(ctx, /openai|chatCompletion/i);

  const fnMatch = ctx.match(
    /export async function buildAgentTurnContext\([\s\S]*$/ 
  );
  assert.ok(fnMatch, "buildAgentTurnContext body");
  const fn = fnMatch[0];
  const iKnowledge = fn.indexOf("const selected = selectKnowledgeChunks");
  const iRoute = fn.indexOf("const sourceDecision = routeSource");
  const iEvidence = fn.indexOf("const publicEvidence = decidePublicEvidence");
  const iPrompt = fn.indexOf("systemPrompt = buildChatSystemPrompt");
  const iFilter = fn.indexOf("filterCapabilitiesForSourceRoute");
  assert.ok(iKnowledge > 0 && iRoute > iKnowledge, "route after knowledge");
  assert.ok(iEvidence > iRoute, "evidence after route");
  assert.ok(iPrompt > iEvidence, "prompt after evidence");
  assert.ok(iFilter > iPrompt, "capability filter after prompt base");
  console.log("ok  turn-context exports + trust order");
}

function testChatServiceWiresBuilder() {
  const chat = read("lib/services/chat.service.js");
  assert.match(chat, /buildAgentTurnContext/);
  assert.match(chat, /from "@\/lib\/services\/ai\/turn-context"/);
  assert.match(chat, /systemPrompt:\s*system/);
  assert.match(chat, /suppressedPublicReadNames/);
  assert.doesNotMatch(chat, /selectKnowledgeChunks\s*\(/);
  assert.doesNotMatch(chat, /buildChatSystemPrompt\s*\(/);
  assert.doesNotMatch(chat, /decidePublicEvidence\s*\(/);
  assert.match(chat, /runTurn\s*\(/);
  console.log("ok  chat.service wires builder then runTurn");
}

function main() {
  testLanguageContractInSource();
  testModuleExportsAndOrder();
  testChatServiceWiresBuilder();
  console.log("\nturn-context smoke passed");
}

main();
