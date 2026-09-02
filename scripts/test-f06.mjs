/**
 * F06 A–H contract smoke — admin security hardening.
 * Run: npm run test:f06
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

function walkAdminRoutes(dir, out = []) {
  for (const name of fs.readdirSync(dir)) {
    const full = path.join(dir, name);
    const st = fs.statSync(full);
    if (st.isDirectory()) walkAdminRoutes(full, out);
    else if (name === "route.js") out.push(full);
  }
  return out;
}

function main() {
  const f06 = featureDoc(root, "F06");
  for (const letter of ["A", "B", "C", "D", "E", "F", "G", "H"]) {
    assert(
      new RegExp(`Phase ${letter} — .+ ✅`).test(f06),
      `F06 Phase ${letter} should be marked done`
    );
  }

  const adminEmail = read("lib/admin-email.js");
  assert(/isProtectedAdminEmail/.test(adminEmail), "protected email helper");
  assert(/reservedAdminEmail/.test(adminEmail), "settings reserved check");
  assert(/role:\s*"ADMIN"/.test(adminEmail), "DB ADMIN check");

  const auth = read("auth.js");
  assert(/isProtectedAdminEmail/.test(auth), "auth uses protected email");
  assert(/admin_needs_seed/.test(auth), "needs-seed error code");
  assert(/AdminPasswordOnlyError/.test(auth), "google admin block");
  assert(/TooManyAttemptsError/.test(auth), "admin rate limit");

  const authService = read("lib/services/auth.service.js");
  assert(
    /isProtectedAdminEmail/.test(authService),
    "register blocks protected email"
  );

  const store = read("store/auth-store.js");
  assert(/ADMIN_NEEDS_SEED|admin_needs_seed/.test(store), "needs-seed UI");
  assert(/15 minutes|seed:admin/.test(store), "lockout / seed copy");
  assert(/Google is not allowed/.test(store), "google-admin copy");

  const proxy = read("proxy.js");
  assert(/\/admin/.test(proxy) && /404/.test(proxy), "admin → 404 rewrite");
  assert(/role === "ADMIN"|role !== "ADMIN"/.test(proxy), "role gate");

  const routes = walkAdminRoutes(path.join(root, "app/api/admin"));
  assert(routes.length >= 15, `expected many admin routes, got ${routes.length}`);
  for (const file of routes) {
    const body = fs.readFileSync(file, "utf8");
    assert(
      /requireAdmin/.test(body),
      `missing requireAdmin: ${path.relative(root, file)}`
    );
  }

  const audit = read("lib/services/audit.service.js");
  assert(/EXPORT_MAX\s*=\s*10_000/.test(audit), "export cap 10k");
  assert(/listAuditEvents/.test(audit), "paginated list");

  const users = read("lib/services/admin-users.service.js");
  assert(/_count:\s*\{\s*select:\s*\{\s*workspaces/.test(users), "no N+1 counts");

  const schema = read("prisma/schema.prisma");
  assert(/reservedAdminEmail/.test(schema), "schema reserved field");

  const mig = read(
    "prisma/migrations/20260823090000_platform_reserved_admin_email/migration.sql"
  );
  assert(/reservedAdminEmail/.test(mig), "migration present");

  const seed = read("prisma/seed-admin.js");
  assert(/reservedAdminEmail/.test(seed), "seed writes reserved email");
  assert(/Cannot seed a second admin|second admin/i.test(seed), "one-admin guard");

  const settings = read("lib/services/platform-settings.service.js");
  assert(/setReservedAdminEmail/.test(settings), "settings setter");
  assert(
    !/patch\.reservedAdminEmail/.test(settings),
    "settings UI cannot patch reserved email"
  );

  const readme = read("README.md");
  assert(
    /Seed the one admin/i.test(readme) && /DATABASE_URL/i.test(readme),
    "README seed section"
  );
  assert(/production Neon|prod DATABASE_URL|same DATABASE_URL/i.test(readme), "prod seed note");

  console.log(`ok  F06 A–H admin security (${routes.length} admin routes gated)`);
  console.log("\nF06 smoke passed");
}

main();
