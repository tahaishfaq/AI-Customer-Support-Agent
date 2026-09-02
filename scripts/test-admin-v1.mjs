import "dotenv/config";
import { randomBytes } from "node:crypto";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { Pool } from "pg";
import bcrypt from "bcrypt";
import { withVerifyFullSsl } from "../lib/pg-connection.js";
import { uniqueTestIpHeaders } from "./lib/test-client-ip.mjs";

const BASE = process.env.TEST_BASE_URL || "http://127.0.0.1:3000";
const ADMIN_EMAIL = process.env.ADMIN_BOOTSTRAP_EMAIL;
const ADMIN_PASSWORD = process.env.ADMIN_BOOTSTRAP_PASSWORD;

function assert(ok, message) {
  if (!ok) throw new Error(message);
}

function cookieJar() {
  const map = new Map();
  return {
    absorb(res) {
      const list =
        typeof res.headers.getSetCookie === "function"
          ? res.headers.getSetCookie()
          : [];
      for (const raw of list) {
        const pair = raw.split(";")[0];
        const i = pair.indexOf("=");
        if (i > 0) map.set(pair.slice(0, i).trim(), pair.slice(i + 1));
      }
    },
    header() {
      return [...map.entries()].map(([k, v]) => `${k}=${v}`).join("; ");
    },
  };
}

async function json(res) {
  const text = await res.text();
  try {
    return text ? JSON.parse(text) : null;
  } catch {
    return { _raw: text.slice(0, 200) };
  }
}

async function signIn(email, password) {
  const jar = cookieJar();
  const csrfRes = await fetch(`${BASE}/api/auth/csrf`);
  jar.absorb(csrfRes);
  const csrf = await json(csrfRes);
  assert(csrf?.csrfToken, "csrf token missing");

  const loginRes = await fetch(`${BASE}/api/auth/callback/credentials`, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Cookie: jar.header(),
    },
    body: new URLSearchParams({
      csrfToken: csrf.csrfToken,
      email,
      password,
      redirect: "false",
    }),
    redirect: "manual",
  });
  jar.absorb(loginRes);

  const sessionRes = await fetch(`${BASE}/api/auth/session`, {
    headers: { Cookie: jar.header() },
  });
  const session = await json(sessionRes);
  return { jar, session, loginStatus: loginRes.status };
}

async function adminFetch(jar, path, options = {}) {
  const headers = {
    Cookie: jar.header(),
    ...(options.body ? { "Content-Type": "application/json" } : {}),
    ...(options.headers || {}),
  };
  return fetch(`${BASE}${path}`, { ...options, headers });
}

async function main() {
  if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is not set");
  if (!ADMIN_EMAIL || !ADMIN_PASSWORD) {
    throw new Error("ADMIN_BOOTSTRAP_EMAIL / PASSWORD required");
  }

  const pool = new Pool({
    connectionString: withVerifyFullSsl(process.env.DATABASE_URL),
  });
  const stamp = Date.now();
  const testEmail = `admin-v1-${stamp}@aide.test`;
  const testPass = "TestPass-admin-v1!";
  const hash = await bcrypt.hash(testPass, 10);
  const userId = `c${randomBytes(12).toString("hex")}`;
  const workspaceId = `c${randomBytes(12).toString("hex")}`;
  const agentId = `c${randomBytes(12).toString("hex")}`;
  const publicKey = `pk${randomBytes(10).toString("hex")}`;
  const conversationId = `c${randomBytes(12).toString("hex")}`;
  const messageId = `c${randomBytes(12).toString("hex")}`;
  const knowledgeId = `c${randomBytes(12).toString("hex")}`;
  const knowledgeBody = "Refunds are processed within 5 business days.";
  const failed = [];
  const passed = [];
  let settingsSnapshot;

  async function test(name, fn) {
    try {
      await fn();
      passed.push(name);
      console.log(`PASS  ${name}`);
    } catch (error) {
      failed.push({ name, error: error.message || String(error) });
      console.log(`FAIL  ${name}: ${error.message || error}`);
    }
  }

  try {
    await test("anon admin API is 401", async () => {
      const res = await fetch(`${BASE}/api/admin/overview`);
      assert(res.status === 401, `expected 401 got ${res.status}`);
    });

    await test("anon /admin is 404", async () => {
      const res = await fetch(`${BASE}/admin`, { redirect: "manual" });
      assert(res.status === 404, `expected 404 got ${res.status}`);
    });

    await test("anon /admin/login is 404", async () => {
      const res = await fetch(`${BASE}/admin/login`, { redirect: "manual" });
      assert(res.status === 404, `expected 404 got ${res.status}`);
    });

    let admin;
    await test("admin credentials sign-in", async () => {
      admin = await signIn(ADMIN_EMAIL, ADMIN_PASSWORD);
      assert(admin.session?.user?.id, "no admin session");
      assert(admin.session.user.role === "ADMIN", "session role is not ADMIN");
    });

    if (!admin?.jar) throw new Error("Cannot continue without admin session");

    await test("GET /api/admin/overview", async () => {
      const res = await adminFetch(admin.jar, "/api/admin/overview");
      const body = await json(res);
      assert(res.status === 200, `status ${res.status}`);
      assert(body.overview, "missing overview");
      assert(typeof body.overview.users === "number", "missing users kpi");
    });

    await test("GET /api/admin/analytics/dashboard platform", async () => {
      const res = await adminFetch(
        admin.jar,
        "/api/admin/analytics/dashboard?range=7d"
      );
      const body = await json(res);
      assert(res.status === 200, `status ${res.status} ${JSON.stringify(body).slice(0, 200)}`);
      assert(body.platform, "missing platform totals");
      assert(typeof body.platform.users === "number", "platform users");
      assert(Array.isArray(body.growth?.points), "growth points");
      assert(body.overview, "chat overview");
    });

    await test("GET /api/admin/users pagination", async () => {
      const res = await adminFetch(admin.jar, "/api/admin/users?page=1&pageSize=20");
      const body = await json(res);
      assert(res.status === 200, `status ${res.status}`);
      assert(Array.isArray(body.users), "users array");
      assert(typeof body.total === "number", "total");
    });

    await test("GET /api/admin/settings + public platform", async () => {
      const res = await adminFetch(admin.jar, "/api/admin/settings");
      const body = await json(res);
      assert(res.status === 200, `status ${res.status} ${JSON.stringify(body)}`);
      assert(typeof body.settings.signupsEnabled === "boolean", "signupsEnabled");
      settingsSnapshot = body.settings;
      const pub = await fetch(`${BASE}/api/public/platform`);
      const p = await json(pub);
      assert(pub.status === 200, "public platform");
      assert(typeof p.signupsEnabled === "boolean", "public signups");
    });

    await test("GET /api/admin/audit pagination + date filter", async () => {
      const res = await adminFetch(admin.jar, "/api/admin/audit?page=1");
      const body = await json(res);
      assert(res.status === 200, `status ${res.status}`);
      assert(Array.isArray(body.events), "events");
      assert(typeof body.page === "number", "page");
      const from = encodeURIComponent("2000-01-01T00:00");
      const to = encodeURIComponent("2000-01-02T00:00");
      const empty = await adminFetch(
        admin.jar,
        `/api/admin/audit?from=${from}&to=${to}`
      );
      const emptyBody = await json(empty);
      assert(empty.status === 200, "date filter");
      assert(emptyBody.total === 0, "empty range should be 0");
    });

    await test("GET /api/admin/audit/export", async () => {
      const res = await adminFetch(admin.jar, "/api/admin/audit/export");
      const body = await json(res);
      assert(res.status === 200, `status ${res.status}`);
      assert(Array.isArray(body.events), "export events");
    });

    await test("GET /api/admin/restore-requests", async () => {
      const res = await adminFetch(
        admin.jar,
        "/api/admin/restore-requests?status=PENDING"
      );
      assert(res.status === 200, `status ${res.status}`);
    });

    await test("seed isolated USER + workspace + agent + chat", async () => {
      await pool.query(
        `INSERT INTO "User" (id, name, email, "passwordHash", role, status, "createdAt", "updatedAt")
         VALUES ($1, $2, $3, $4, 'USER', 'ACTIVE', NOW(), NOW())`,
        [userId, "Admin V1 Probe", testEmail, hash]
      );
      await pool.query(
        `INSERT INTO "Workspace" (id, "userId", name, "createdAt", "updatedAt")
         VALUES ($1, $2, 'Probe workspace', NOW(), NOW())`,
        [workspaceId, userId]
      );
      await pool.query(
        `INSERT INTO "Agent" (id, "userId", "workspaceId", name, "systemPrompt", "welcomeMessage", "publicKey", enabled, "embedEnabled", "createdAt", "updatedAt")
         VALUES ($1, $2, $3, 'Probe agent', 'You are a test agent.', 'Hello', $4, true, true, NOW(), NOW())`,
        [agentId, userId, workspaceId, publicKey]
      );
      await pool.query(
        `INSERT INTO "Conversation" (id, "agentId", "startedAt", "createdAt")
         VALUES ($1, $2, NOW(), NOW())`,
        [conversationId, agentId]
      );
      await pool.query(
        `INSERT INTO "Message" (id, "conversationId", role, content, "createdAt")
         VALUES ($1, $2, 'USER', 'hello from probe', NOW())`,
        [messageId, conversationId]
      );
      await pool.query(
        `INSERT INTO "KnowledgeDocument" (id, "agentId", name, type, content, "createdAt", "updatedAt")
         VALUES ($1, $2, 'Refund FAQ', 'TEXT', $3, NOW(), NOW())`,
        [knowledgeId, agentId, knowledgeBody]
      );
    });

    await test("USER session cannot call admin APIs", async () => {
      const userAuth = await signIn(testEmail, testPass);
      assert(userAuth.session?.user?.role === "USER", "probe is USER");
      const res = await adminFetch(userAuth.jar, "/api/admin/overview");
      assert(res.status === 401, `expected 401 got ${res.status}`);
      const page = await fetch(`${BASE}/admin`, {
        headers: { Cookie: userAuth.jar.header() },
        redirect: "manual",
      });
      assert(page.status === 404, `USER /admin status ${page.status}`);
    });

    await test("exactly one ADMIN in the database", async () => {
      const row = await pool.query(
        `SELECT COUNT(*)::int AS n FROM "User" WHERE role = 'ADMIN'`
      );
      assert(row.rows[0].n === 1, `ADMIN count ${row.rows[0].n}`);
    });

    await test("inspect user + workspaces + workspace + agent", async () => {
      const u = await adminFetch(admin.jar, `/api/admin/users/${userId}`);
      const user = await json(u);
      assert(u.status === 200, `user ${u.status}`);
      assert(user.user.email === testEmail, "email");
      const ws = await adminFetch(
        admin.jar,
        `/api/admin/users/${userId}/workspaces`
      );
      assert(ws.status === 200, `workspaces ${ws.status}`);
      const one = await adminFetch(
        admin.jar,
        `/api/admin/workspaces/${workspaceId}`
      );
      assert(one.status === 200, `workspace ${one.status}`);
      const ag = await adminFetch(admin.jar, `/api/admin/agents/${agentId}`);
      const agent = await json(ag);
      assert(ag.status === 200, `agent ${ag.status}`);
      assert(agent.agent.id === agentId, "agent id");
      const docs = agent.agent.knowledge || [];
      assert(
        docs.some(
          (d) =>
            d.name &&
            (d.type === "TEXT" || d.type === "PDF" || d.type === "WEB") &&
            d.content == null
        ),
        "inspect lists knowledge metadata without dumping full body"
      );
      assert(docs.length >= 1, "knowledge list present");
    });

    await test("analytics + conversations + thread", async () => {
      const dash = await adminFetch(
        admin.jar,
        `/api/admin/analytics/dashboard?workspaceId=${workspaceId}&range=7d`
      );
      assert(dash.status === 200, `analytics ${dash.status}`);
      const list = await adminFetch(
        admin.jar,
        `/api/admin/agents/${agentId}/conversations`
      );
      assert(list.status === 200, `inbox ${list.status}`);
      const thread = await adminFetch(
        admin.jar,
        `/api/admin/conversations/${conversationId}`
      );
      const body = await json(thread);
      assert(thread.status === 200, `thread ${thread.status}`);
      assert(Array.isArray(body.conversation?.messages), "messages");
      const audit = await adminFetch(
        admin.jar,
        `/api/admin/audit?action=AGENT_OPEN&pageSize=20`
      );
      const auditBody = await json(audit);
      assert(audit.status === 200, `audit ${audit.status}`);
      assert(
        (auditBody.events || []).some((e) => e.targetId === agentId),
        "AGENT_OPEN not in audit"
      );
      const chatAudit = await adminFetch(
        admin.jar,
        `/api/admin/audit?action=CONVERSATION_OPEN&pageSize=20`
      );
      const chatAuditBody = await json(chatAudit);
      assert(
        (chatAuditBody.events || []).some((e) => e.targetId === conversationId),
        "CONVERSATION_OPEN not in audit"
      );
    });

    await test("disable agent + embed off hides widget", async () => {
      const live = await fetch(`${BASE}/w/${publicKey}`, { redirect: "manual" });
      assert(live.status === 200, `live widget ${live.status}`);
      const off = await adminFetch(
        admin.jar,
        `/api/admin/agents/${agentId}/embed-disable`,
        { method: "POST", body: JSON.stringify({ embedEnabled: false }) }
      );
      assert(off.status === 200, `embed-disable ${off.status}`);
      const dead = await fetch(`${BASE}/w/${publicKey}`, { redirect: "manual" });
      assert(dead.status === 404, `killed widget ${dead.status}`);
      const on = await adminFetch(
        admin.jar,
        `/api/admin/agents/${agentId}/embed-disable`,
        { method: "POST", body: JSON.stringify({ embedEnabled: true }) }
      );
      assert(on.status === 200, `embed-enable ${on.status}`);
      const disable = await adminFetch(
        admin.jar,
        `/api/admin/agents/${agentId}/disable`,
        { method: "POST", body: JSON.stringify({ enabled: false }) }
      );
      assert(disable.status === 200, `disable ${disable.status}`);
      const dead2 = await fetch(`${BASE}/w/${publicKey}`, { redirect: "manual" });
      assert(dead2.status === 404, `disabled agent widget ${dead2.status}`);
      await adminFetch(admin.jar, `/api/admin/agents/${agentId}/disable`, {
        method: "POST",
        body: JSON.stringify({ enabled: true }),
      });
    });

    await test("suspend / restore + cannot suspend last admin", async () => {
      const sus = await adminFetch(admin.jar, `/api/admin/users/${userId}/suspend`, {
        method: "POST",
      });
      assert(sus.status === 200, `suspend ${sus.status}`);
      const blocked = await signIn(testEmail, testPass);
      assert(!blocked.session?.user?.id, "suspended user must not get session");
      const rest = await adminFetch(admin.jar, `/api/admin/users/${userId}/restore`, {
        method: "POST",
      });
      assert(rest.status === 200, `restore ${rest.status}`);
      const adminRow = await pool.query(
        `SELECT id FROM "User" WHERE role = 'ADMIN' LIMIT 1`
      );
      const adminId = adminRow.rows[0].id;
      const bad = await adminFetch(
        admin.jar,
        `/api/admin/users/${adminId}/suspend`,
        { method: "POST" }
      );
      assert(bad.status === 400 || bad.status === 403, `admin suspend ${bad.status}`);
    });

    await test("global embed kill hides public widget", async () => {
      const get = await adminFetch(admin.jar, "/api/admin/settings");
      const current = (await json(get)).settings;
      const kill = await adminFetch(admin.jar, "/api/admin/settings", {
        method: "PUT",
        body: JSON.stringify({ globalEmbedKill: true }),
      });
      assert(kill.status === 200, `kill ${kill.status}`);
      const dead = await fetch(`${BASE}/w/${publicKey}`, { redirect: "manual" });
      assert(dead.status === 404, `global kill widget ${dead.status}`);
      const restore = await adminFetch(admin.jar, "/api/admin/settings", {
        method: "PUT",
        body: JSON.stringify({
          globalEmbedKill: Boolean(current.globalEmbedKill),
        }),
      });
      assert(restore.status === 200, `restore embed kill ${restore.status}`);
      const live = await fetch(`${BASE}/w/${publicKey}`, { redirect: "manual" });
      assert(live.status === 200, `widget after restore ${live.status}`);
    });

    await test("settings round-trip signups closed", async () => {
      const get = await adminFetch(admin.jar, "/api/admin/settings");
      settingsSnapshot = (await json(get)).settings;
      const off = await adminFetch(admin.jar, "/api/admin/settings", {
        method: "PUT",
        body: JSON.stringify({ signupsEnabled: false }),
      });
      const offBody = await json(off);
      assert(off.status === 200, `put off ${off.status} ${JSON.stringify(offBody)}`);
      assert(offBody.settings.signupsEnabled === false, "signups false");
      const reg = await fetch(`${BASE}/api/auth/register`, {
        method: "POST",
        headers: uniqueTestIpHeaders({ "Content-Type": "application/json" }),
        body: JSON.stringify({
          name: "Closed Signup",
          email: `closed-${stamp}@aide.test`,
          password: "ClosedSignup1!",
          confirmPassword: "ClosedSignup1!",
        }),
      });
      assert(reg.status === 403, `register while closed ${reg.status}`);
      const on = await adminFetch(admin.jar, "/api/admin/settings", {
        method: "PUT",
        body: JSON.stringify({
          signupsEnabled: settingsSnapshot.signupsEnabled,
        }),
      });
      assert(on.status === 200, `restore settings ${on.status}`);
    });

    await test("export user JSON", async () => {
      const res = await adminFetch(admin.jar, `/api/admin/users/${userId}/export`);
      const body = await json(res);
      assert(res.status === 200, `export ${res.status}`);
      assert(body.user?.email === testEmail, "export email");
      assert(Array.isArray(body.workspaces), "workspaces");
      assert(body.workspaces[0]?.agents?.length >= 1, "agents in export");
    });

    await test("hard-delete requires email + cannot delete admin", async () => {
      const wrong = await adminFetch(admin.jar, `/api/admin/users/${userId}`, {
        method: "DELETE",
        body: JSON.stringify({ emailConfirm: "wrong@example.com" }),
      });
      assert(wrong.status === 400, `wrong email ${wrong.status}`);
      const adminRow = await pool.query(
        `SELECT id, email FROM "User" WHERE role = 'ADMIN' LIMIT 1`
      );
      const delAdmin = await adminFetch(
        admin.jar,
        `/api/admin/users/${adminRow.rows[0].id}`,
        {
          method: "DELETE",
          body: JSON.stringify({ emailConfirm: adminRow.rows[0].email }),
        }
      );
      assert(
        delAdmin.status === 400,
        `must not delete admin, got ${delAdmin.status}`
      );
      const ok = await adminFetch(admin.jar, `/api/admin/users/${userId}`, {
        method: "DELETE",
        body: JSON.stringify({ emailConfirm: testEmail }),
      });
      const okBody = await json(ok);
      assert(ok.status === 200, `delete ${ok.status} ${JSON.stringify(okBody)}`);
      const gone = await pool.query(`SELECT id FROM "User" WHERE id = $1`, [userId]);
      assert(gone.rows.length === 0, "user still in db");
    });

    await test("README documents admin seed", async () => {
      const readme = readFileSync(
        join(dirname(fileURLToPath(import.meta.url)), "..", "README.md"),
        "utf8"
      );
      assert(readme.includes("npm run seed:admin"), "missing seed:admin");
      assert(readme.includes("ADMIN_BOOTSTRAP_EMAIL"), "missing bootstrap email");
      assert(readme.includes("Seed the one admin"), "missing seed heading");
    });

    await test("admin pages 200", async () => {
      const paths = [
        "/admin",
        "/admin/users",
        "/admin/requests",
        "/admin/safety",
        "/admin/audit",
      ];
      for (const path of paths) {
        const res = await fetch(`${BASE}${path}`, {
          headers: { Cookie: admin.jar.header() },
        });
        assert(res.status === 200, `${path} ${res.status}`);
      }
    });
  } finally {
    await pool.query(`DELETE FROM "User" WHERE email = $1`, [testEmail]);
    if (settingsSnapshot) {
      try {
        await pool.query(
          `UPDATE "PlatformSettings"
           SET "signupsEnabled" = $1, "globalEmbedKill" = $2
           WHERE id = 'global'`,
          [
            settingsSnapshot.signupsEnabled,
            Boolean(settingsSnapshot.globalEmbedKill),
          ]
        );
      } catch {
        // ignore
      }
    }
    await pool.end();
  }

  console.log("\n--- admin v1 ---");
  console.log(`passed ${passed.length}  failed ${failed.length}`);
  if (failed.length) {
    for (const item of failed) console.log(` - ${item.name}: ${item.error}`);
    process.exit(1);
  }
}

main().catch((error) => {
  console.error("admin v1 crashed:", error.message || error);
  process.exit(1);
});
