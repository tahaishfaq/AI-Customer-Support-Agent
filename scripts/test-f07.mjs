/**
 * F07 A–H contract smoke — admin platform density.
 * Run: npm run test:f07
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
  const f07 = featureDoc(root, "F07");
  for (const letter of ["A", "B", "C", "D", "E", "F", "G", "H"]) {
    assert(
      new RegExp(`Phase ${letter} — .+ ✅`).test(f07),
      `F07 Phase ${letter} should be marked done`
    );
  }
  assert(/inspect-only|no act-as-user/i.test(f07), "identity");
  assert(/Out:.*impersonat/i.test(f07), "impersonation out of scope");

  const overview = read("lib/services/admin-overview.service.js");
  assert(/pendingRestoreCount/.test(overview), "pending restore count");
  assert(/suspendedUsers/.test(overview), "suspended users count");

  const sidebar = read("components/admin/AdminSidebar.jsx");
  assert(/pendingRestoreCount|badge/.test(sidebar), "requests badge");
  assert(/getAdminOverview/.test(sidebar), "sidebar loads overview");

  const usersDir = read("components/admin/AdminUsersDirectory.jsx");
  assert(/searchParams\.get\("q"\)/.test(usersDir), "URL q");
  assert(/searchParams\.get\("status"\)/.test(usersDir), "URL status");
  assert(/searchParams\.get\("role"\)/.test(usersDir), "URL role");
  assert(/setTimeout\(/.test(usersDir), "search debounce");
  assert(/EmptyState/.test(usersDir), "empty state");
  assert(/InlineAlert/.test(usersDir), "error retry");

  const inspect = read("lib/services/admin-inspect.service.js");
  assert(/lastChatAt/.test(inspect), "last chat field");
  assert(/slice\(0,\s*140\)/.test(inspect), "list preview only");
  assert(
    !/knowledgeDocs:[\s\S]{0,200}content:\s*true/.test(inspect),
    "agent inspect should not select knowledge content"
  );

  const agentUi = read("components/admin/AdminAgentInspect.jsx");
  assert(/Last chat|lastChatAt/.test(agentUi), "last chat UI");

  const dash = read("components/admin/AdminPlatformAnalytics.jsx");
  assert(/href=.*\/admin\/users/.test(dash), "users deep link");
  assert(/status=SUSPENDED/.test(dash), "suspended deep link");
  assert(/\/admin\/requests/.test(dash), "requests deep link");
  assert(/Growth KPIs|Quality KPIs/.test(dash), "growth vs quality");

  const requests = read("components/admin/AdminRestoreRequests.jsx");
  assert(/Open all users/.test(requests), "bulk view helper");
  assert(/OPEN_ALL_CAP|slice\(0,\s*10\)/.test(requests), "open-all cap");

  const suspend = read("app/api/admin/users/[id]/suspend/route.js");
  const exp = read("app/api/admin/users/[id]/export/route.js");
  assert(/USER_SUSPEND_FAILED/.test(suspend), "suspend fail audit");
  assert(/USER_EXPORT_FAILED/.test(exp), "export fail audit");

  const auditUi = read("components/admin/AdminAuditLog.jsx");
  assert(/USER_SUSPEND_FAILED/.test(auditUi), "fail filter chip");
  assert(/InlineAlert/.test(auditUi) && /truncated/.test(auditUi), "truncate banner");

  const userExport = read("lib/services/admin-user-data.service.js");
  assert(/truncated/.test(userExport) && /MESSAGE_CAP/.test(userExport), "export cap");

  assert(/test:f07/.test(read("package.json")), "npm script");

  console.log("ok  F07 A–H admin platform improvements");
  console.log("\nF07 smoke passed");
}

main();
