/**
 * F01 Phase E smoke — no SDK retries, degraded skips classify, success logs gated.
 * Run: npm run test:f01e
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");

function assert(ok, message) {
  if (!ok) throw new Error(message);
}

function read(rel) {
  return fs.readFileSync(path.join(root, rel), "utf8");
}

function testSource() {
  const provider = read("lib/services/ai/llm.provider.js");
  assert(
    /maxRetries:\s*0/.test(provider),
    "OpenAI client must set maxRetries: 0 to avoid double-bill on timeout"
  );

  const chat = read("lib/services/chat.service.js");
  assert(
    chat.includes("degraded") &&
      /category\s*=\s*"GENERAL"/.test(chat) &&
      /sentiment\s*=\s*"NEUTRAL"/.test(chat) &&
      chat.includes("if (!degraded)"),
    "degraded chat must skip classify LLM and use GENERAL/NEUTRAL"
  );

  const log = read("lib/observability/safe-log.js");
  assert(
    log.includes("safeLogInfoSampled") && log.includes("LOG_CHAT_SUCCESS"),
    "safe-log must gate success/info chat volume"
  );

  const env = read(".env.example");
  assert(
    env.includes("LOG_CHAT_SUCCESS") && env.includes("OPENAI_TIMEOUT_MS"),
    ".env.example should document Phase E log/timeout knobs"
  );

  console.log("ok  Phase E source contracts");
}

async function testSampleGate() {
  const { safeLogInfoSampled } = await import(
    "../lib/observability/safe-log.js"
  );

  const originalInfo = console.info;
  let infoCount = 0;
  console.info = () => {
    infoCount += 1;
  };

  try {
    delete process.env.LOG_CHAT_SUCCESS;
    delete process.env.LOG_INFO_SAMPLE_RATE;
    for (let i = 0; i < 20; i += 1) {
      safeLogInfoSampled("chat ok should be dropped");
    }
    assert(infoCount === 0, "success chat logs must be off by default");

    process.env.LOG_CHAT_SUCCESS = "1";
    safeLogInfoSampled("chat ok opt-in");
    assert(infoCount === 1, "LOG_CHAT_SUCCESS=1 should emit info");
    console.log("ok  success log gate (off by default / opt-in)");
  } finally {
    delete process.env.LOG_CHAT_SUCCESS;
    delete process.env.LOG_INFO_SAMPLE_RATE;
    console.info = originalInfo;
  }
}

async function main() {
  testSource();
  await testSampleGate();
  console.log("\nF01-E smoke passed");
}

main().catch((error) => {
  console.error("\nF01-E smoke FAILED:", error.message);
  process.exit(1);
});
