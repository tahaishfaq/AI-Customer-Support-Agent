/**
 * F02 Phase G smoke — Neon/Vercel/Redis infra docs + chat maxDuration.
 * Run: npm run test:f02g
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

function main() {
  const f02 = featureDoc(root, "F02");
  assert(
    /Phase G — Infrastructure ✅/.test(f02),
    "F02 Phase G should be marked done"
  );
  assert(
    /Upstash|Redis/i.test(f02) && /not yet|defer|deferred/i.test(f02),
    "F02-G must record Redis decision (deferred)"
  );
  assert(
    /read replica/i.test(f02) && /No —|not |defer/i.test(f02),
    "F02-G must record read-replica decision"
  );

  const readme = read("README.md");
  assert(
    /pooler/i.test(readme) &&
      readme.includes("DIRECT_URL") &&
      readme.includes("DATABASE_URL"),
    "README must document Neon pooler vs DIRECT_URL"
  );
  assert(
    /maxDuration/i.test(readme) && readme.includes("OPENAI_TIMEOUT_MS"),
    "README must document Vercel maxDuration vs OpenAI timeout"
  );
  assert(
    /Upstash|Redis/i.test(readme) && /deferred|not yet/i.test(readme),
    "README must note Redis deferred"
  );
  console.log("ok  README infra docs");

  const pub = read("app/api/public/agents/[publicKey]/chat/route.js");
  const studio = read("app/api/agents/[id]/chat/route.js");
  assert(
    /maxDuration\s*=\s*60/.test(pub) && /maxDuration\s*=\s*60/.test(studio),
    "chat routes must export maxDuration = 60"
  );

  const env = read(".env.example");
  assert(
    env.includes("-pooler") && env.includes("PG_POOL_MAX"),
    ".env.example must mention pooler + PG_POOL_MAX"
  );
  console.log("ok  Phase G contracts");

  console.log("\nF02-G smoke passed");
}

try {
  main();
} catch (error) {
  console.error("\nF02-G smoke FAILED:", error.message);
  process.exit(1);
}
