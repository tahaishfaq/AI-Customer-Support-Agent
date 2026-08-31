/**
 * F11 UX-3 smoke — connection health copy + ActionsForm wiring.
 * Run: npm run test:f11-ux3
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  CONN_MSG,
  connectionHealthTitle,
  friendlyConnectionError,
} from "../lib/actions/connection-health.js";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");

function assert(ok, message) {
  if (!ok) throw new Error(message);
}

function read(rel) {
  return fs.readFileSync(path.join(root, rel), "utf8");
}

function main() {
  assert(
    /Key invalid or revoked in your system/.test(CONN_MSG.INVALID_KEY),
    "401 copy matches UX-3"
  );
  assert(
    friendlyConnectionError(null, { ok: false, httpStatus: 401 }) ===
      CONN_MSG.INVALID_KEY,
    "maps HTTP 401"
  );
  assert(
    friendlyConnectionError(null, {
      ok: false,
      errorCode: "CREDENTIAL_REVOKED",
    }) === CONN_MSG.INVALID_KEY,
    "maps credential revoked"
  );
  assert(
    friendlyConnectionError(null, { ok: false, httpStatus: 403 }) ===
      CONN_MSG.FORBIDDEN,
    "maps 403"
  );
  assert(
    friendlyConnectionError(null, {
      ok: false,
      status: "TIMEOUT",
      errorCode: "TIMEOUT",
    }) === CONN_MSG.TIMEOUT,
    "maps timeout"
  );
  assert(connectionHealthTitle(null) === "Not tested");
  assert(connectionHealthTitle({ ok: true }) === "Connected");
  assert(connectionHealthTitle({ ok: false }) === "Not connected");

  const form = read("components/customization/ActionsForm.jsx");
  const mcp = read("components/customization/McpServersPanel.jsx");
  const health = read("lib/actions/connection-health.js");
  assert(/Revoke key/.test(form), "revoke copy");
  assert(
    /paste a fresh key to reconnect/.test(form),
    "rotate / reconnect instructions"
  );
  assert(/Test connection/.test(mcp), "MCP test connection CTA");
  assert(
    /friendlyConnectionError/.test(health) &&
      /connectionHealthTitle/.test(health),
    "connection health helpers"
  );

  const shipped = read("docs/SHIPPED_FEATURES.md");
  assert(/UX-3/.test(shipped), "SHIPPED documents UX-3");

  console.log("ok  UX-3 connection health helpers");
  console.log("ok  ActionsForm connection contracts");
  console.log("\nF11 UX-3 smoke passed");
}

try {
  main();
} catch (error) {
  console.error("\nF11 UX-3 smoke FAILED:", error.message);
  process.exit(1);
}
