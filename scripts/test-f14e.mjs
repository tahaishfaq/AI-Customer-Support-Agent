/**
 * F14-E smoke — token TTL, expired confirm refuse, approve rate-limit, refresh hooks.
 * Run: npm run test:f14e
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  identitySessionMaxTtlMs,
  isConversationIdentityExpired,
  resolveIdentityExpiresAt,
} from "../lib/actions/identity-ttl.js";
import {
  pubConfirmLimitOpts,
  studioConfirmLimitOpts,
} from "../lib/rate-limit-config.js";

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
  assert(identitySessionMaxTtlMs() >= 60_000, "session TTL");
  const withExp = resolveIdentityExpiresAt({ exp: Math.floor(Date.now() / 1000) + 120 });
  assert(withExp.getTime() > Date.now(), "JWT exp → future");
  const opaque = resolveIdentityExpiresAt({});
  assert(opaque.getTime() > Date.now(), "opaque gets capped expiry");

  assert(
    isConversationIdentityExpired({
      identityExpiresAt: new Date(Date.now() - 1000),
    }),
    "past expiry"
  );
  assert(
    !isConversationIdentityExpired({
      identityExpiresAt: new Date(Date.now() + 60_000),
    }),
    "future ok"
  );

  assert(pubConfirmLimitOpts().limit >= 1, "pub confirm limit");
  assert(studioConfirmLimitOpts().limit >= 1, "studio confirm limit");

  const svc = read("lib/services/confirmation.service.js");
  assert(/expireStalePendingConfirmations/.test(svc), "expire stale");
  assert(/CONFIRMATION_EXPIRED/.test(svc), "refuse expired");
  assert(/confirmationTtlMs|ACTIONS_CONFIRMATION_TTL/.test(svc), "TTL env");

  const chat = read("lib/services/chat.service.js");
  assert(/identityRefreshRequired/.test(chat), "chat refresh flag");
  assert(/isConversationIdentityExpired/.test(chat), "chat checks TTL");
  assert(/resolveIdentityExpiresAt/.test(chat), "stamps expiry");

  const pubRoute = read(
    "app/api/public/agents/[publicKey]/confirmations/[confirmationId]/route.js"
  );
  assert(/pubConfirmLimitOpts/.test(pubRoute), "public confirm rate limit");

  const appRoute = read(
    "app/api/conversations/[id]/confirmations/[confirmationId]/route.js"
  );
  assert(/studioConfirmLimitOpts/.test(appRoute), "studio confirm rate limit");

  const embed = read("app/embed.js/route.js");
  assert(/authRefreshRequired/.test(embed), "embed refresh message");
  assert(/onAuthRefreshNeeded/.test(embed), "host refresh hook");

  const webchat = read("components/embed/PublicWebchat.jsx");
  assert(/authRefreshRequired/.test(webchat), "webchat notifies parent");
  assert(/identityRefreshRequired/.test(webchat), "handles chat flag");

  const card = read("components/chat/ActionConfirmCard.jsx");
  assert(/expired/i.test(card), "card expired copy");
  assert(/Too many attempts/.test(card), "card rate-limit copy");

  assert(exists("lib/actions/identity-ttl.js"), "identity-ttl module");

  const plan = read("docs/features/F14_END_USER_AUTH_AND_ACTION_CONSENT.md");
  assert(/Phase E/.test(plan) && /✅/.test(plan), "F14 E marked done");

  console.log("ok  identity TTL + expiry helpers");
  console.log("ok  confirm refuse + rate-limit + refresh hooks");
  console.log("\nF14-E smoke passed");
}

try {
  main();
} catch (error) {
  console.error("\nF14-E smoke FAILED:", error.message);
  process.exit(1);
}
