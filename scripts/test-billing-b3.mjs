import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");

function assert(ok, message) {
  if (!ok) throw new Error(message);
}

function read(relPath) {
  return fs.readFileSync(path.join(root, relPath), "utf8");
}

async function main() {
  const constants = read("lib/billing/constants.js");
  assert(
    constants.includes('"PAST_DUE"'),
    "PRODUCT_UNLOCK_STATUSES must include PAST_DUE"
  );

  const entitlements = read("lib/billing/entitlements.service.js");
  assert(
    entitlements.includes("assertCanCreateWorkspace"),
    "entitlements service required"
  );

  const workspace = read("lib/services/workspace.service.js");
  assert(
    workspace.includes("assertCanCreateWorkspace"),
    "workspace create must use plan limits"
  );

  const agent = read("lib/services/agent.service.js");
  assert(
    agent.includes("assertCanCreateAgent"),
    "agent create must use plan limits"
  );

  const requireProduct = read("lib/require-product.js");
  assert(
    requireProduct.includes("billing_past_due"),
    "past due must block creates"
  );

  const shell = read("components/layout/AppShell.jsx");
  assert(shell.includes("BillingPastDueBanner"), "past due banner in shell");

  assert(
    fs.existsSync(path.join(root, "app/(app)/settings/billing/page.jsx")),
    "settings billing page required"
  );

  console.log("B3 static checks passed");
}

main().catch((err) => {
  console.error(err.message || err);
  process.exit(1);
});
