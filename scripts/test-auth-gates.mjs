import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { resolveFastPostAuthPath } from "../lib/auth-home.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");

function assert(ok, message) {
  if (!ok) throw new Error(message);
}

function read(relPath) {
  return fs.readFileSync(path.join(root, relPath), "utf8");
}

async function expectRedirect(pathname, { allowLogin = true } = {}) {
  const base = (process.env.TEST_BASE_URL || "http://127.0.0.1:3000").replace(
    /\/$/,
    ""
  );
  const res = await fetch(`${base}${pathname}`, { redirect: "manual" });
  const location = res.headers.get("location") || "";
  if (allowLogin) {
    assert(
      res.status === 307 || res.status === 302 || res.status === 308,
      `${pathname} should redirect when logged out (got ${res.status})`
    );
    assert(
      location.includes("/login"),
      `${pathname} should redirect to /login (got ${location})`
    );
    if (pathname !== "/login") {
      assert(
        location.includes("next=") || location.includes(`next=${encodeURIComponent(pathname)}`),
        `${pathname} redirect should preserve next= (${location})`
      );
    }
  }
  return { status: res.status, location };
}

async function expectUnauthorized(apiPath) {
  const base = (process.env.TEST_BASE_URL || "http://127.0.0.1:3000").replace(
    /\/$/,
    ""
  );
  const res = await fetch(`${base}${apiPath}`);
  assert(
    res.status === 401,
    `${apiPath} should return 401 when logged out (got ${res.status})`
  );
}

async function main() {
  const proxy = read("proxy.js");
  const appLayout = read("app/(app)/layout.jsx");
  const authMe = read("app/api/auth/me/route.js");

  assert(proxy.includes('"/inbox"'), "proxy must protect /inbox");
  assert(
    appLayout.includes("redirectForSessionUser"),
    "app layout must distinguish expired vs suspended sessions"
  );
  assert(
    resolveFastPostAuthPath({ role: "ADMIN" }) === "/admin",
    "admin fast path"
  );
  assert(
    resolveFastPostAuthPath({ role: "USER" }, "", { freshSignup: true }) ===
      "/billing/onboarding",
    "fresh signup fast path"
  );
  assert(
    resolveFastPostAuthPath({ role: "USER" }, "/agents/new") ===
      "/auth/continue?next=%2Fagents%2Fnew",
    "next= product path goes through continue"
  );
  assert(
    resolveFastPostAuthPath({ role: "USER" }) === "/auth/continue",
    "default user fast path"
  );

  assert(
    fs.existsSync(path.join(root, "app/auth/continue/page.jsx")),
    "post-auth continue page must exist"
  );

  assert(
    authMe.includes("destination"),
    "/api/auth/me must expose destination for post-auth routing"
  );

  const routes = [
    "/dashboard",
    "/agents",
    "/agents/new",
    "/inbox",
    "/chat",
    "/conversations",
    "/analytics",
    "/billing/onboarding",
    "/billing/plans",
  ];

  for (const route of routes) {
    const { status, location } = await expectRedirect(route);
    console.log(`anon ${route} → ${status} ${location}`);
  }

  const apis = ["/api/auth/me", "/api/billing/status", "/api/agents"];
  for (const api of apis) {
    await expectUnauthorized(api);
    console.log(`anon ${api} → 401`);
  }

  console.log("Auth gate checks passed.");
}

main().catch((err) => {
  console.error(err.message || err);
  process.exit(1);
});
