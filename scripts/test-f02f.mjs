/**
 * F02 Phase F smoke — rate-limit config + soft caps defaults.
 * Run: npm run test:f02f
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
import { featureDoc } from "./lib/shipped-doc.mjs";


function assert(ok, message) {
  if (!ok) throw new Error(message);
}

function read(rel) {
  return fs.readFileSync(path.join(root, rel), "utf8");
}

async function testConfig() {
  const {
    pubChatLimitOpts,
    studioChatLimitOpts,
    pubPingLimitOpts,
    registerLimitOpts,
  } = await import("../lib/rate-limit-config.js");

  assert(pubChatLimitOpts().limit >= 20, "pub chat should allow burst ≥20");
  assert(studioChatLimitOpts().limit >= 40, "studio chat should allow burst ≥40");
  assert(pubPingLimitOpts().limit >= 8, "ping limit present");
  assert(registerLimitOpts().windowMs >= 60_000, "register window present");

  process.env.RATE_LIMIT_PUB_CHAT = "99";
  assert(pubChatLimitOpts().limit === 99, "RATE_LIMIT_PUB_CHAT override");
  delete process.env.RATE_LIMIT_PUB_CHAT;
  console.log("ok  rate-limit-config");
}

function testSource() {
  const f02 = featureDoc(root, "F02");
  assert(
    /Phase F — Scaling ✅/.test(f02),
    "F02 Phase F should be marked done"
  );

  const pub = read("app/api/public/agents/[publicKey]/chat/route.js");
  const studio = read("app/api/agents/[id]/chat/route.js");
  assert(
    pub.includes("pubChatLimitOpts") && studio.includes("studioChatLimitOpts"),
    "chat routes must use rate-limit-config"
  );

  const settings = read("lib/services/platform-settings.service.js");
  assert(
    /maxAgentsPerWorkspace:\s*25/.test(settings) &&
      /maxWorkspacesPerUser:\s*10/.test(settings),
    "PlatformSettings defaults should be soft cost brakes"
  );

  const f02doc = f02;
  assert(
    /read replica/i.test(f02doc) && /Phase G/i.test(f02doc),
    "F02-F must defer read replica to Phase G decision"
  );
  console.log("ok  Phase F source contracts");
}

async function main() {
  testSource();
  await testConfig();
  console.log("\nF02-F smoke passed");
}

main().catch((error) => {
  console.error("\nF02-F smoke FAILED:", error.message);
  process.exit(1);
});
