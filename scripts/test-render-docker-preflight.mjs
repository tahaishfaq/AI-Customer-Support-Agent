/**
 * Preflight for Render Docker deploys — catch known build killers before push.
 * Run: node scripts/test-render-docker-preflight.mjs
 *
 * Covers:
 * - package-lock in sync with package.json (npm ci would fail otherwise)
 * - Dockerfile OpenSSL for Prisma on bookworm-slim
 * - NEXT_BUILD_CPUS cap (OOM during "Collecting page data" with 40+ workers)
 * - next.config.mjs honors NEXT_BUILD_CPUS
 * - worker production start without tsx
 * - SERVICE_ROLE entrypoint present
 */
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = (rel) => fs.readFileSync(path.join(root, rel), "utf8");

{
  const pkg = JSON.parse(read("package.json"));
  const lock = JSON.parse(read("package-lock.json"));
  assert.equal(lock.name, pkg.name, "lockfile name matches package.json");
  assert.equal(lock.lockfileVersion >= 2, true, "lockfileVersion is modern");
  for (const name of Object.keys(pkg.dependencies || {})) {
    const inLock =
      lock.packages?.[`node_modules/${name}`] ||
      lock.dependencies?.[name];
    assert.ok(inLock, `dependency ${name} must be present in package-lock.json`);
  }
  // Exact npm ci contract (no install) — fails when lock is stale.
  execFileSync("npm", ["ci", "--ignore-scripts", "--dry-run"], {
    cwd: root,
    stdio: "pipe",
    env: { ...process.env, npm_config_loglevel: "error" },
  });
  console.log("ok  package-lock sync (npm ci --dry-run)");
}

{
  const dockerfile = read("Dockerfile");
  assert.match(dockerfile, /openssl/, "Dockerfile installs openssl for Prisma");
  assert.match(
    dockerfile,
    /NEXT_BUILD_CPUS\s*=\s*2/,
    "Dockerfile caps NEXT_BUILD_CPUS (prevents OOM page-data workers)"
  );
  assert.match(
    dockerfile,
    /max-old-space-size/,
    "Dockerfile sets NODE_OPTIONS heap cap for next build"
  );
  assert.match(
    dockerfile,
    /render-entrypoint\.sh/,
    "Dockerfile CMD uses render-entrypoint.sh"
  );
  console.log("ok  Dockerfile openssl + worker cap + entrypoint");
}

{
  const nextConfig = read("next.config.mjs");
  assert.match(nextConfig, /NEXT_BUILD_CPUS/, "next.config.mjs reads NEXT_BUILD_CPUS");
  assert.match(nextConfig, /cpus/, "next.config.mjs sets experimental.cpus when capped");
  console.log("ok  next.config.mjs build CPU cap");
}

{
  const pkg = JSON.parse(read("package.json"));
  const prod = pkg.scripts?.["worker:jobs:prod"] || "";
  assert.match(prod, /^node /, "worker:jobs:prod must use node (tsx is devDependency)");
  assert.doesNotMatch(prod, /\btsx\b/, "worker:jobs:prod must not invoke tsx");
  assert.match(
    prod,
    /register-aliases\.mjs/,
    "worker:jobs:prod must load alias register"
  );
  console.log("ok  worker:jobs:prod (no tsx)");
}

{
  const entry = read("scripts/render-entrypoint.sh");
  assert.match(entry, /SERVICE_ROLE/, "entrypoint switches on SERVICE_ROLE");
  assert.match(entry, /worker:jobs:prod/, "jobs role starts BullMQ worker");
  assert.match(entry, /npm run start/, "web role starts the configured app runtime");
  console.log("ok  render-entrypoint.sh roles");
}

{
  const yaml = read("render.yaml");
  const pkg = JSON.parse(read("package.json"));
  assert.match(yaml, /name:\s*aide-web/, "blueprint defines aide-web");
  assert.doesNotMatch(yaml, /name:\s*aide-jobs/, "blueprint must not recreate the removed worker");
  assert.doesNotMatch(yaml, /type:\s*(?:worker|keyvalue|redis)\b/, "HTTP-only deployment has no worker or Redis resource");
  assert.match(yaml, /dockerCommand: node node_modules\/next\/dist\/bin\/next start/, "existing images bypass the Redis-dependent custom server");
  for (const flag of ["REDIS_ENABLED", "BULLMQ_ENABLED", "REALTIME_ENABLED", "REALTIME_DESK_ENABLED", "REALTIME_EMBED_ENABLED", "REALTIME_BILLING_ENABLED"]) {
    assert.match(yaml, new RegExp(`key: ${flag}\\s+value: "0"`), `${flag} must be disabled`);
  }
  assert.doesNotMatch(yaml, /key:\s*(?:REDIS_URL|REALTIME_REDIS_URL)\b/, "removed Redis credentials are not requested");
  assert.match(pkg.scripts.dev, /^next dev\b/, "local development starts without Redis");
  assert.match(pkg.scripts.start, /^next start\b/, "production startup starts without Redis");
  assert.doesNotMatch(
    yaml,
    /generateValue:\s*true/,
    "must not generate AUTH_SECRET (would invalidate sessions / break crypto pairing)"
  );
  console.log("ok  render.yaml topology");
}

{
  const enqueue = read("lib/jobs/enqueue.js");
  const queues = read("lib/jobs/queues.js");
  const worker = read("workers/job-worker.mjs");
  assert.match(
    enqueue,
    /export async function enqueueRecrawlSweep/,
    "enqueueRecrawlSweep must be exported (worker calls it on boot)"
  );
  assert.match(queues, /RECRAWL_SWEEP/, "CRAWL_JOBS.RECRAWL_SWEEP must exist");
  assert.match(worker, /enqueueRecrawlSweep/, "job-worker schedules recrawl sweep");
  console.log("ok  recrawl sweep wiring");
}

console.log("render-docker-preflight: ok");
