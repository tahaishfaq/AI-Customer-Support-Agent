/**
 * F11 redesign R5 smoke — action packs + oauth helper + API route.
 * Run: npm run test:f11r5
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { fetchClientCredentialsToken } from "../lib/integrations/oauth-client-credentials.js";
import { canAdvanceProcedure, companyPackForBusiness, validateCompanyPack } from "../lib/integrations/company-pack.js";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");

function assert(ok, message) {
  if (!ok) throw new Error(message);
}

function exists(rel) {
  return fs.existsSync(path.join(root, rel));
}

function read(rel) {
  return fs.readFileSync(path.join(root, rel), "utf8");
}

function testExports() {
  assert(exists("lib/integrations/action-pack.js"), "action-pack.js");
  assert(
    exists("lib/integrations/oauth-client-credentials.js"),
    "oauth-client-credentials.js"
  );
  const pack = read("lib/integrations/action-pack.js");
  assert(/export async function createActionPack/.test(pack), "createActionPack export");
  assert(/demo_order/.test(pack) && /booking/.test(pack), "packs defined");
  assert(/ticket/.test(pack) && /subscription/.test(pack), "ticket+subscription packs");
  assert(/shopify_lite/.test(pack) && /hubspot_lite/.test(pack), "UX-4 vertical packs");
  assert(typeof fetchClientCredentialsToken === "function", "oauth helper export");
  console.log("ok  action-pack + oauth helper exports");
}

function testApiRoute() {
  assert(
    exists("app/api/agents/[id]/action-packs/route.js"),
    "action-packs API route exists"
  );
  const route = read("app/api/agents/[id]/action-packs/route.js");
  assert(/createActionPack/.test(route), "route calls createActionPack");
  assert(/packId/.test(route), "route accepts packId");
  console.log("ok  API route exists");
}

async function testOauthValidation() {
  try {
    await fetchClientCredentialsToken({});
    throw new Error("should have failed");
  } catch (err) {
    assert(err.code === "OAUTH_INVALID" || err.status === 400, "oauth validates");
  }
  console.log("ok  oauth helper validates inputs");
}

function testCompanyPacks() {
  for (const vertical of ["E-commerce", "SaaS"]) {
    const pack = companyPackForBusiness({ vertical });
    assert(validateCompanyPack(pack).ok, `${vertical} pack validates`);
    assert(pack.capabilitySlots.includes("PUBLIC_READ"), `${vertical} public slot`);
    assert(pack.confirmation.write === true, `${vertical} write confirmation`);
  }
  assert(canAdvanceProcedure("apply_policy", "propose").ok, "procedure advances in order");
  assert(canAdvanceProcedure("propose", "execute").errorCode === "PROCEDURE_ORDER_INVALID", "procedure skips are rejected");
  assert(canAdvanceProcedure("confirm", "execute", { confirmed: true }).ok, "confirmed execution advances");
  const companyPackSrc = read("lib/integrations/company-pack.js");
  assert(/control_plane_metadata/.test(companyPackSrc), "packs marked control-plane metadata");
  assert(/companyPackIsRuntimeAuthority/.test(companyPackSrc), "runtime authority helper exported");
  console.log("ok  company packs + procedure guard for E-commerce and SaaS");
}

async function main() {
  testExports();
  testApiRoute();
  testCompanyPacks();
  await testOauthValidation();
  console.log("\nF11-R5 smoke passed");
}

try {
  await main();
} catch (error) {
  console.error("\nF11-R5 smoke FAILED:", error.message);
  process.exit(1);
}
