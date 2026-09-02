/**
 * F14-C smoke — host setUser + identity resolve + end-user outbound auth.
 * Run: npm run test:f14c
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  fingerprintToken,
  resolveEndUserIdentity,
  signCustomerIdentityToken,
} from "../lib/actions/identity.js";
import { applyCredentialToHeaders } from "../lib/actions/credential-apply.js";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");

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
  process.env.AUTH_SECRET =
    process.env.AUTH_SECRET || "dev-auth-secret-32chars-minimum!!";
  process.env.NODE_ENV = process.env.NODE_ENV || "development";

  const jwt = signCustomerIdentityToken({
    sub: "user_jwt_1",
    exp: Math.floor(Date.now() / 1000) + 3600,
  });

  const fromJwt = resolveEndUserIdentity({ identityToken: jwt });
  assert(fromJwt?.sub === "user_jwt_1", "JWT identity sub");
  assert(fromJwt?.strategy === "hs256_jwt", "JWT strategy");
  assert(fromJwt?.tokenFingerprint, "JWT fingerprint");

  const fromBearer = resolveEndUserIdentity({ bearerToken: jwt });
  assert(fromBearer?.sub === "user_jwt_1", "Bearer JWT sub");

  const host = resolveEndUserIdentity({
    userSession: {
      subject: "user_host_9",
      displayName: "Sam",
      accessToken: "opaque-site-token",
    },
  });
  assert(host?.sub === "user_host_9", "host session subject");
  assert(host?.strategy === "host_session", "host strategy");
  assert(host?.accessToken === "opaque-site-token", "opaque access token");
  assert(host?.displayName === "Sam", "displayName");
  assert(
    fingerprintToken("opaque-site-token") === host.tokenFingerprint,
    "fingerprint matches"
  );

  // Foreign site JWT (e.g. Brandly) + subject must stay host_session, not HS256 verify.
  const foreignJwt =
    "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJicmFuZGx5LXVzZXIiLCJpYXQiOjE3MDAwMDAwMDB9.not-a-hapy-signature";
  const hostForeign = resolveEndUserIdentity({
    userSession: {
      subject: "69c8c3f9b71736236f3195ad",
      displayName: "Devline",
      accessToken: foreignJwt,
    },
  });
  assert(hostForeign?.strategy === "host_session", "foreign JWT → host_session");
  assert(hostForeign?.sub === "69c8c3f9b71736236f3195ad", "keeps host subject");
  assert(hostForeign?.accessToken === foreignJwt, "keeps outbound JWT");

  assert(resolveEndUserIdentity({}) === null, "empty → null");

  const headers = applyCredentialToHeaders(
    {},
    { type: "BEARER", plaintext: "owner-admin-key" },
    {
      endUserAccessToken: "user-access-xyz",
      preferEndUserAuth: true,
    }
  );
  assert(
    headers.Authorization === "Bearer user-access-xyz",
    "prefer end-user Bearer over owner"
  );

  const apiKeyPlusUser = applyCredentialToHeaders(
    {},
    { type: "API_KEY_HEADER", plaintext: "brnd_live_demo", headerName: "X-API-KEY" },
    {
      endUserAccessToken: "user-access-xyz",
      preferEndUserAuth: true,
    }
  );
  assert(apiKeyPlusUser["X-API-KEY"] === "brnd_live_demo", "keep API key header");
  assert(
    apiKeyPlusUser.Authorization === "Bearer user-access-xyz",
    "user Bearer with API key"
  );

  const embed = read("app/embed.js/route.js");
  assert(/setUser/.test(embed), "embed setUser");
  assert(/hapy-host/.test(embed), "host postMessage source");
  assert(/type: "ready"/.test(embed) || /type === "ready"/.test(embed), "ready handshake");

  const webchat = read("components/embed/PublicWebchat.jsx");
  assert(/userSession/.test(webchat), "webchat sends userSession");
  assert(/hapy-host/.test(webchat), "webchat listens setUser");
  assert(/type === "ready"/.test(webchat) || /type: "ready"/.test(webchat), "ready ping");

  const chatVal = read("lib/validations/chat.js");
  assert(/userSession/.test(chatVal), "chat schema userSession");

  const pubRoute = read("app/api/public/agents/[publicKey]/chat/route.js");
  assert(/userSession/.test(pubRoute), "public chat passes userSession");
  assert(/bearerToken/.test(pubRoute), "Authorization Bearer");

  const chatSvc = read("lib/services/chat.service.js");
  assert(/resolveEndUserIdentity/.test(chatSvc), "chat resolves identity");
  assert(/endUserAccessToken/.test(chatSvc), "passes endUserAccessToken");

  const loop = read("lib/actions/tool-loop.js");
  assert(/preferEndUserAuth/.test(loop), "tool-loop preferEndUserAuth");
  assert(
    /END_USER_TOKEN/.test(loop) || /requiresIdentity && endUserAccessToken/.test(loop),
    "identity tools use user token"
  );

  assert(exists("lib/actions/identity.js"), "identity module");
  const idSrc = read("lib/actions/identity.js");
  assert(/resolveEndUserIdentity/.test(idSrc), "resolveEndUserIdentity export");

  const snippet = read("lib/customization/embed.js");
  assert(/setUser/.test(snippet), "deploy snippet documents setUser");

  const plan = read("docs/features/F14_END_USER_AUTH_AND_ACTION_CONSENT.md");
  assert(/Phase C/.test(plan) && /✅/.test(plan), "F14 plan marks C done");

  console.log("ok  resolveEndUserIdentity strategies");
  console.log("ok  embed setUser + chat/outbound wiring");
  console.log("\nF14-C smoke passed");
}

try {
  main();
} catch (error) {
  console.error("\nF14-C smoke FAILED:", error.message);
  process.exit(1);
}
