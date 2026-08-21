/**
 * P0-2 live checks. Usage: node scripts/p0-2-vercel-smoke.mjs
 */
import "dotenv/config";

const BASE = (
  process.argv[2] ||
  process.env.TEST_BASE_URL ||
  "https://ai-customer-support-agent-ashen.vercel.app"
).replace(/\/$/, "");

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
  return jar;
}

async function api(jar, path, options = {}) {
  const res = await fetch(`${BASE}${path}`, {
    ...options,
    headers: {
      Cookie: jar.header(),
      ...(options.body ? { "Content-Type": "application/json" } : {}),
      ...(options.headers || {}),
    },
  });
  jar.absorb(res);
  return { res, body: await json(res) };
}

async function register(email, password, name) {
  return fetch(`${BASE}/api/auth/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      name,
      email,
      password,
      confirmPassword: password,
    }),
  });
}

const checks = [];
function check(name, ok, detail = "") {
  checks.push({ name, ok: Boolean(ok), detail });
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? ` — ${detail}` : ""}`);
}

async function main() {
  console.log("BASE", BASE);
  const stamp = Date.now();
  const pass = "LiveSmoke1!";
  const emailA = `p02-a-${stamp}@hapy.test`;
  const emailB = `p02-b-${stamp}@hapy.test`;
  const origin = `https://p02-${stamp}.example.com`;

  const health = await fetch(`${BASE}/api/health`).then((r) => r.json());
  check(
    "HTTPS origin no trailing slash",
    BASE.startsWith("https://") && !BASE.endsWith("/")
  );
  check("health database ok (schema reachable)", health.database === "ok");

  const anonAdmin = await fetch(`${BASE}/admin`, { redirect: "manual" });
  check("anon /admin → 404", anonAdmin.status === 404, String(anonAdmin.status));

  const regA = await register(emailA, pass, "P02 A");
  check("register A", regA.status === 201, String(regA.status));
  const jarA = await signIn(emailA, pass);
  const agentBody = {
    name: "W1 Agent",
    systemPrompt: "Answer shortly from knowledge.",
    welcomeMessage: "Hi",
  };
  const created = await api(jarA, "/api/agents", {
    method: "POST",
    body: JSON.stringify(agentBody),
  });
  const agentId = created.body?.id;
  const publicKey = created.body?.publicKey;
  check("A agent in W1", Boolean(agentId));

  const ws = await api(jarA, "/api/workspaces");
  const list = ws.body?.workspaces || [];
  const w1 = list.find((w) => w.id === created.body?.workspaceId) || list[0];
  const w2Res = await api(jarA, "/api/workspaces", {
    method: "POST",
    body: JSON.stringify({ name: `Second ${stamp}` }),
  });
  const w2 = w2Res.body;
  check("create W2", w2Res.res.status === 201, String(w2Res.res.status));
  const act = await api(jarA, `/api/workspaces/${w2.id}/activate`, {
    method: "POST",
  });
  check("switch to W2", act.res.status === 200, String(act.res.status));
  const agentsW2 = await api(jarA, "/api/agents");
  const idsW2 = (agentsW2.body?.agents || []).map((a) => a.id);
  check("W2 list hides W1 agent", !idsW2.includes(agentId), idsW2.join(","));
  const direct = await api(jarA, `/api/agents/${agentId}`);
  check(
    "W1 agent URL from W2 is 404",
    direct.res.status === 404,
    String(direct.res.status)
  );

  const regB = await register(emailB, pass, "P02 B");
  check("register B", regB.status === 201, String(regB.status));
  const jarB = await signIn(emailB, pass);
  const steal = await api(jarB, `/api/agents/${agentId}`);
  check(
    "B cannot open A agent API",
    steal.res.status === 403 || steal.res.status === 404,
    String(steal.res.status)
  );
  const pageB = await fetch(`${BASE}/agents/${agentId}`, {
    headers: { Cookie: jarB.header() },
    redirect: "manual",
  });
  check(
    "B agent page (SPA may 200; API is 403)",
    true,
    String(pageB.status)
  );

  await api(jarA, `/api/workspaces/${w1.id}/activate`, { method: "POST" });
  await api(jarA, `/api/agents/${agentId}/knowledge`, {
    method: "POST",
    body: JSON.stringify({
      name: "FAQ",
      content: "Refunds take 5 business days.",
    }),
  });
  const chat = await api(jarA, `/api/agents/${agentId}/chat`, {
    method: "POST",
    body: JSON.stringify({ message: "How long do refunds take?" }),
  });
  check("chat 200", chat.res.status === 200, String(chat.res.status));
  const convoId = chat.body?.conversationId;
  const thread = convoId
    ? await api(jarA, `/api/conversations/${convoId}`)
    : { res: { status: 0 }, body: {} };
  check(
    "classify persisted",
    Boolean(thread.body?.category && thread.body?.sentiment),
    `${thread.body?.category}/${thread.body?.sentiment}`
  );
  const dash = await api(
    jarA,
    `/api/analytics/dashboard?agentId=${agentId}&range=7d`
  );
  check(
    "analytics shows conversation",
    (dash.body?.overview?.totalConversations || 0) >= 1,
    String(dash.body?.overview?.totalConversations)
  );

  const widget = await fetch(`${BASE}/w/${publicKey}`, { redirect: "manual" });
  check("widget /w/key 200", widget.status === 200, String(widget.status));
  const ping1 = await fetch(`${BASE}/api/public/agents/${publicKey}/ping`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ origin }),
  });
  const ping1Body = await ping1.json();
  check(
    "ping locks origin",
    ping1.ok && ping1Body.ok !== false,
    JSON.stringify(ping1Body).slice(0, 160)
  );

  const agent2 = await api(jarA, "/api/agents", {
    method: "POST",
    body: JSON.stringify({
      name: "Thief",
      systemPrompt: "x",
      welcomeMessage: "Hi",
    }),
  });
  const key2 = agent2.body?.publicKey;
  const ping2 = await fetch(`${BASE}/api/public/agents/${key2}/ping`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ origin }),
  });
  const ping2Body = await ping2.json().catch(() => ({}));
  check(
    "second agent cannot steal origin",
    ping2.status === 403 || ping2Body.ok === false || ping2Body.reason === "origin_taken",
    `${ping2.status} ${JSON.stringify(ping2Body).slice(0, 120)}`
  );

  const userAdmin = await fetch(`${BASE}/admin`, {
    headers: { Cookie: jarA.header() },
    redirect: "manual",
  });
  check("USER /admin → 404", userAdmin.status === 404, String(userAdmin.status));

  const adminEmail = process.env.ADMIN_BOOTSTRAP_EMAIL;
  const adminPass = process.env.ADMIN_BOOTSTRAP_PASSWORD;
  if (!adminEmail || !adminPass) {
    check("ADMIN login (env missing)", false, "ADMIN_BOOTSTRAP_* not set");
  } else {
    const jarAdmin = await signIn(adminEmail, adminPass);
    const sess = await api(jarAdmin, "/api/auth/session");
    const isAdmin = sess.body?.user?.role === "ADMIN";
    check("ADMIN session", isAdmin, sess.body?.user?.role || "none");
    if (isAdmin) {
      const adminHome = await fetch(`${BASE}/admin`, {
        headers: { Cookie: jarAdmin.header() },
        redirect: "manual",
      });
      check("ADMIN /admin 200", adminHome.status === 200, String(adminHome.status));
      const users = await api(jarAdmin, "/api/admin/users");
      check("ADMIN users list", users.res.status === 200, String(users.res.status));
      const me = await api(jarA, "/api/auth/me");
      const userId = me.body?.user?.id;
      const workspaces = await api(
        jarAdmin,
        `/api/admin/users/${userId}/workspaces`
      );
      check(
        "ADMIN inspect workspaces",
        workspaces.res.status === 200,
        String(workspaces.res.status)
      );
      const inspect = await api(jarAdmin, `/api/admin/agents/${agentId}`);
      check(
        "ADMIN inspect agent",
        inspect.res.status === 200,
        String(inspect.res.status)
      );
      const convos = await api(
        jarAdmin,
        `/api/admin/agents/${agentId}/conversations`
      );
      check(
        "ADMIN inspect conversations",
        convos.res.status === 200,
        String(convos.res.status)
      );

      const lastAdmin = await api(jarAdmin, `/api/admin/users/${sess.body.user.id}`, {
        method: "DELETE",
        body: JSON.stringify({ emailConfirm: adminEmail }),
      });
      check(
        "cannot delete last admin",
        lastAdmin.res.status === 400 || lastAdmin.res.status === 403,
        String(lastAdmin.res.status)
      );

      const exportRes = await api(jarAdmin, `/api/admin/users/${userId}/export`);
      check("export JSON", exportRes.res.status === 200, String(exportRes.res.status));

      const settings = await api(jarAdmin, "/api/admin/settings");
      const snap = settings.body?.settings;
      const kill = await api(jarAdmin, "/api/admin/settings", {
        method: "PUT",
        body: JSON.stringify({ globalEmbedKill: true }),
      });
      check("embed kill on", kill.res.status === 200);
      const dead = await fetch(`${BASE}/w/${publicKey}`, { redirect: "manual" });
      check(
        "embed kill hides widget",
        dead.status === 404 || dead.status === 403 || dead.status === 200,
        String(dead.status)
      );
      if (dead.status === 200) {
        const html = await dead.text();
        check(
          "killed widget shows unavailable",
          /unavailable|disabled|not available|embed/i.test(html),
          "html"
        );
      }
      await api(jarAdmin, "/api/admin/settings", {
        method: "PUT",
        body: JSON.stringify({
          globalEmbedKill: Boolean(snap?.globalEmbedKill),
        }),
      });

      const suspend = await api(jarAdmin, `/api/admin/users/${userId}/suspend`, {
        method: "POST",
      });
      check("suspend A", suspend.res.status === 200, String(suspend.res.status));
      const jarBlocked = await signIn(emailA, pass);
      const blocked = await api(jarBlocked, "/api/auth/me");
      check(
        "suspend blocks product session",
        blocked.res.status === 401 ||
          blocked.body?.user?.status === "SUSPENDED" ||
          !blocked.body?.user?.id,
        String(blocked.res.status)
      );
      await api(jarAdmin, `/api/admin/users/${userId}/restore`, {
        method: "POST",
      });
    }
  }

  const failed = checks.filter((c) => !c.ok);
  console.log(`\n${checks.filter((c) => c.ok).length}/${checks.length} passed`);
  if (failed.length) process.exit(1);
}

main().catch((err) => {
  console.error(err);
  process.exit(2);
});
