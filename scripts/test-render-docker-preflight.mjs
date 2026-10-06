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
  assert.match(entry, /npm run start/, "web role starts server.js");
  console.log("ok  render-entrypoint.sh roles");
}

{
  const yaml = read("render.yaml");
  assert.match(yaml, /name:\s*aide-web/, "blueprint defines aide-web");
  assert.match(yaml, /name:\s*aide-jobs/, "blueprint defines aide-jobs");
  assert.match(yaml, /SERVICE_ROLE/, "blueprint sets SERVICE_ROLE");
  assert.match(yaml, /BULLMQ_ENABLED/, "blueprint enables BullMQ");
  assert.doesNotMatch(
    yaml,
    /generateValue:\s*true/,
    "must not generate AUTH_SECRET (would invalidate sessions / break crypto pairing)"
  );
  console.log("ok  render.yaml topology");
}

console.log("render-docker-preflight: ok");
