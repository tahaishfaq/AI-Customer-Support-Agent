/**
 * Task 10 — Company-pack is control-plane metadata; chat runtime stays the trust path.
 * Run: npm run test:company-pack-runtime
 */
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  COMPANY_PACK_RUNTIME_ROLE,
  canAdvanceProcedure,
  companyPackForBusiness,
  companyPackIsRuntimeAuthority,
  serializeCompanyPackForInstall,
  validateCompanyPack,
} from "../lib/integrations/company-pack.js";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");

function read(rel) {
  return fs.readFileSync(path.join(root, rel), "utf8");
}

const RUNTIME_FILES = [
  "lib/orchestrator/index.js",
  "lib/orchestrator/loop.js",
  "lib/services/chat.service.js",
  "lib/services/ai/turn-context.js",
  "lib/actions/invoke-tool.js",
  "lib/actions/policy.js",
];

function testNotRuntimeAuthority() {
  assert.equal(companyPackIsRuntimeAuthority(), false);
  assert.equal(COMPANY_PACK_RUNTIME_ROLE, "control_plane_metadata");
  const pack = companyPackForBusiness({ vertical: "E-commerce" });
  assert.ok(validateCompanyPack(pack).ok);
  const serialized = serializeCompanyPackForInstall(pack);
  assert.equal(serialized.runtimeAuthority, false);
  assert.equal(serialized.runtimeRole, COMPANY_PACK_RUNTIME_ROLE);
  assert.ok(Array.isArray(serialized.procedure));
  console.log("ok  pack is metadata, not runtime authority");
}

function testCatalogHelperStillWorks() {
  assert.equal(canAdvanceProcedure("confirm", "execute", { confirmed: false }).ok, false);
  assert.equal(canAdvanceProcedure("confirm", "execute", { confirmed: true }).ok, true);
  console.log("ok  catalog procedure helper remains pure");
}

function testRuntimeDoesNotImportCompanyPack() {
  for (const rel of RUNTIME_FILES) {
    const src = read(rel);
    assert.doesNotMatch(
      src,
      /company-pack|canAdvanceProcedure|companyPackForBusiness/,
      `${rel} must not import company-pack`
    );
  }
  console.log("ok  orchestrator/chat/tool path does not import company-pack");
}

function testInstallSerializationWiring() {
  const actionPack = read("lib/integrations/action-pack.js");
  assert.match(actionPack, /serializeCompanyPackForInstall/);
  const adr = read("docs/decisions/004-company-pack-runtime-boundary.md");
  assert.match(adr, /Demote company-pack procedures/);
  assert.match(adr, /POLICY PEP/);
  console.log("ok  install + ADR document single runtime story");
}

testNotRuntimeAuthority();
testCatalogHelperStillWorks();
testRuntimeDoesNotImportCompanyPack();
testInstallSerializationWiring();
console.log("company-pack-runtime: ok");
