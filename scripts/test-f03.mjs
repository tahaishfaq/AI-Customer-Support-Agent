/**
 * F03 A–H contract smoke — docs, CI, product smoke hardening, README gates.
 * Run: npm run test:f03
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

function exists(rel) {
  return fs.existsSync(path.join(root, rel));
}

function main() {
  const f03 = featureDoc(root, "F03");
  for (const letter of ["A", "B", "C", "D", "E", "F", "G", "H"]) {
    assert(
      new RegExp(`Phase ${letter} — .+ ✅`).test(f03),
      `F03 Phase ${letter} should be marked done`
    );
    assert(
      f03.includes(`## Phase ${letter}`) && /### Delivered/.test(f03),
      `F03 Phase ${letter} needs Delivered`
    );
  }

  assert(
    /lint CI/i.test(f03) &&
      /product HTTP smoke/i.test(f03) &&
      /admin smoke/i.test(f03) &&
      /embed origin/i.test(f03) &&
      /go-live checklist/i.test(f03),
    "F03-A must list in-scope areas"
  );
  assert(
    /Playwright/i.test(f03) && /Out:/i.test(f03),
    "F03-A must name Playwright out of day-one scope"
  );
  assert(
    /Workspace isolation/i.test(f03) && /Origin-locked embed/i.test(f03),
    "F03-A identity guardrails"
  );

  assert(exists(".github/workflows/ci.yml"), "ci.yml missing");
  const ci = read(".github/workflows/ci.yml");
  assert(/npm run lint/.test(ci), "CI must run lint");
  assert(/test:shipped/.test(ci), "CI must run test:shipped");
  assert(/test:f03/.test(ci) || /test:shipped/.test(ci), "CI must run shipped/f03 contract");
  assert(/test:product/.test(ci), "CI must run test:product when secrets set");
  assert(/test:bugfix/.test(ci), "CI must run test:bugfix when secrets set");
  assert(/test:admin/.test(ci), "CI must run test:admin when admin secrets set");
  assert(
    /Skipping HTTP smoke/i.test(ci) && /TEST_BASE_URL/.test(ci),
    "CI skip path must name secrets explicitly"
  );
  assert(
    /localhost|127\\.0\\.0\\.1/i.test(ci),
    "CI should warn on localhost TEST_BASE_URL"
  );

  const pkg = JSON.parse(read("package.json"));
  assert(pkg.scripts["test:product"], "test:product script");
  assert(pkg.scripts["test:admin"], "test:admin script");
  assert(pkg.scripts["test:bugfix"], "test:bugfix script");
  assert(pkg.scripts["test:f03"], "test:f03 script");
  assert(
    pkg.scripts["test:bugfix"].includes("test-bugfix-regression"),
    "test:bugfix must point at bugfix regression script"
  );

  assert(exists("scripts/test-product.mjs"), "test-product.mjs");
  const product = read("scripts/test-product.mjs");
  assert(/randomUUID/.test(product), "product smoke unique emails (UUID)");
  assert(
    /reserved admin email cannot register/i.test(product),
    "product smoke reserved admin case"
  );
  assert(
    /5\s*business\s*days|knowledgePhrase/i.test(product),
    "product smoke knowledge phrase assert"
  );
  assert(
    /workspace isolation/i.test(product),
    "product smoke workspace isolation"
  );
  assert(
    /One OpenAI call max|one OpenAI/i.test(product),
    "product smoke documents one OpenAI call"
  );
  assert(
    /localhost|127\.0\.0\.1/i.test(product) && /CI/.test(product),
    "product smoke warns localhost in CI"
  );

  assert(exists("scripts/test-bugfix-regression.mjs"), "bugfix script");
  const bugfix = read("scripts/test-bugfix-regression.mjs");
  assert(/origin locking/i.test(bugfix), "bugfix covers origin lock");

  assert(exists("auth.js"), "auth.js");
  const auth = read("auth.js");
  assert(
    /isProtectedAdminEmail/.test(auth) && /signIn/.test(auth),
    "auth must block reserved admin Google signup"
  );

  const readme = read("README.md");
  assert(/## CI/.test(readme), "README CI section");
  assert(
    /TEST_BASE_URL/.test(readme) &&
      /DATABASE_URL/.test(readme) &&
      /OPENAI_API_KEY/.test(readme),
    "README must document CI secrets"
  );
  assert(
    /branch protection/i.test(readme),
    "README must mention branch protection"
  );
  assert(
    /migrate deploy/i.test(readme),
    "README must mention prisma migrate deploy"
  );
  assert(
    /AUTH_URL/.test(readme) && /preview/i.test(readme),
    "README must mention preview AUTH_URL"
  );
  assert(/## Go-live smoke/.test(readme), "README go-live smoke");
  assert(
    /\/admin/.test(readme) && /404/.test(readme),
    "go-live must mention USER /admin 404"
  );

  console.log("PASS  F03 A–H contract smoke");
}

main();
