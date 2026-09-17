/**
 * Go-live #1–7 local verification harness (no secret values printed).
 * Run: npm run test:go-live-local
 *
 * Owner-only steps (#1 credits, #3–7 prod smoke/cutover/signoff) are listed
 * as OWNER_TODO — this script only proves what can be checked in-repo.
 */
import "dotenv/config";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");

function read(rel) {
  return fs.readFileSync(path.join(root, rel), "utf8");
}

function flag(name) {
  const v = String(process.env[name] || "").trim();
  if (!v) return "unset";
  return "set";
}

function runNpm(script) {
  const result = spawnSync("npm", ["run", script], {
    cwd: root,
    encoding: "utf8",
    env: process.env,
  });
  return {
    script,
    ok: result.status === 0,
    status: result.status,
    tail: String(result.stdout || result.stderr || "")
      .trim()
      .split("\n")
      .slice(-3)
      .join(" | "),
  };
}

function testNoLegacyProvider() {
  const hits = [];
  const skip = new Set([
    "node_modules",
    ".git",
    ".tmp",
    "test-results",
    "docs",
    ".next",
    "coverage",
  ]);
  function walk(dir) {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      if (skip.has(entry.name)) continue;
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        walk(full);
        continue;
      }
      if (!/\.(js|jsx|mjs|cjs)$/.test(entry.name)) continue;
      if (entry.name === "test-go-live-local.mjs") continue;
      const text = fs.readFileSync(full, "utf8");
      // Match legacy provider usage, not documentation of the ban itself.
      if (
        /api\.tavily\.com|TAVILY_API_KEY\s*=|from ["'].*tavily|executeWebSearch\s*\(/i.test(
          text
        )
      ) {
        hits.push(path.relative(root, full));
      }
    }
  }
  walk(root);
  assert.equal(hits.length, 0, `legacy search remnants: ${hits.join(", ")}`);
  console.log("ok  #2 no legacy Tavily/custom search runtime");
}

function testHostedWiring() {
  const cfg = read("lib/services/ai/web-search-config.js");
  assert.match(cfg, /OPENAI_WEB_SEARCH_ENABLED/);
  assert.match(cfg, /isHostedWebSearchAllowed/);

  const builtins = read("lib/capabilities/builtins.js");
  assert.match(builtins, /web_search/);

  const phase1 = runNpm("test:openai-web-search-phase1");
  assert.equal(phase1.ok, true, phase1.tail);
  const phase3 = runNpm("test:openai-web-search-phase3");
  assert.equal(phase3.ok, true, phase3.tail);
  console.log("ok  #2 hosted web-search phase1+phase3 contracts");
}

function testEnvPresence() {
  const report = {
    OPENAI_API_KEY: flag("OPENAI_API_KEY"),
    OPENAI_WEB_SEARCH_ENABLED: flag("OPENAI_WEB_SEARCH_ENABLED"),
    OPENAI_WEB_SEARCH_MODEL: flag("OPENAI_WEB_SEARCH_MODEL"),
    AUTH_URL: flag("AUTH_URL"),
    NEXT_PUBLIC_APP_URL: flag("NEXT_PUBLIC_APP_URL"),
    ACTIONS_IDENTITY_SECRET: flag("ACTIONS_IDENTITY_SECRET"),
    ACTIONS_CREDENTIALS_KEY: flag("ACTIONS_CREDENTIALS_KEY"),
    SAFEPAY_WEBHOOK_SECRET: flag("SAFEPAY_WEBHOOK_SECRET"),
  };
  console.log(
    JSON.stringify(
      {
        event: "go_live_env_presence",
        report,
        note: "values never printed",
      },
      null,
      2
    )
  );
  if (report.OPENAI_API_KEY !== "set") {
    console.log("OWNER_TODO #1  set OPENAI_API_KEY with production credits");
  }
  if (String(process.env.OPENAI_WEB_SEARCH_ENABLED || "") !== "true") {
    console.log(
      "OWNER_TODO #2/#3  set OPENAI_WEB_SEARCH_ENABLED=true and run probe:openai-web-search + one A3 live chat"
    );
  } else {
    console.log(
      "NOTE  OPENAI_WEB_SEARCH_ENABLED=true locally — still run OPENAI_WEB_SEARCH_PROBE=1 npm run probe:openai-web-search"
    );
  }
  console.log("OWNER_TODO #4  npm run test:confirmation-ui-browser on running app; prod URL check");
  console.log("OWNER_TODO #5  SafePay test pay → webhook → cancel smoke");
  console.log(
    "OWNER_TODO #6  ACTIONS_* secrets, prisma migrate deploy, HTTPS AUTH_URL, live embed ping"
  );
  console.log("OWNER_TODO #7  tick docs/PRODUCTION_READY_SIGNOFF.md after #1–6");
  console.log("ok  #1–7 owner checklist printed");
}

testNoLegacyProvider();
testHostedWiring();
testEnvPresence();
console.log("go-live-local: ok (code gates); owner TODOs remain");
