import { createHash, randomUUID } from "node:crypto";
import { SignJWT, jwtVerify } from "jose";
import { assertRealtimeSecret, getRealtimeConfig } from "./config.js";
import { ownerRealtimeClaimsSchema, publicRealtimeClaimsSchema } from "./schemas.js";

function secretBytes(config) {
  return new TextEncoder().encode(config.tokenSecret);
}

export async function signOwnerRealtimeToken({
  userId,
  realtimeSessionId,
  role,
  workspaceIds,
  tokenId,
  expiresInSeconds,
  config = getRealtimeConfig(),
}) {
  assertRealtimeSecret(config);
  const now = Math.floor(Date.now() / 1000);
  const exp = now + (expiresInSeconds || config.tokenTtlSeconds);
  const claims = {
    sub: userId,
    sid: realtimeSessionId,
    jti: tokenId || randomUUID(),
    typ: "aide-realtime-owner",
    role,
    workspaceIds,
  };
  return new SignJWT(claims)
    .setProtectedHeader({ alg: "HS256", typ: "JWT" })
    .setIssuer(config.tokenIssuer)
    .setAudience(config.tokenAudience)
    .setIssuedAt(now)
    .setExpirationTime(exp)
    .sign(secretBytes(config));
}

export async function signPublicRealtimeToken({
  conversationId,
  agentId,
  publicKeyId,
  realtimeSessionId,
  customerSubjectHash = null,
  originHash = null,
  expiresInSeconds,
  config = getRealtimeConfig(),
}) {
  assertRealtimeSecret(config);
  const now = Math.floor(Date.now() / 1000);
  const exp = now + (expiresInSeconds || config.tokenTtlSeconds);
  return new SignJWT({
    sub: `conversation:${conversationId}`,
    sid: realtimeSessionId,
    jti: randomUUID(),
    typ: "aide-realtime-public-conversation",
    conversationId,
    agentId,
    publicKeyId,
    customerSubjectHash,
    originHash,
  })
    .setProtectedHeader({ alg: "HS256", typ: "JWT" })
    .setIssuer(config.tokenIssuer)
    .setAudience(config.tokenAudience)
    .setIssuedAt(now)
    .setExpirationTime(exp)
    .sign(secretBytes(config));
}

export async function verifyRealtimeToken(token, { expectedType, config = getRealtimeConfig() } = {}) {
  assertRealtimeSecret(config);
  const { payload } = await jwtVerify(token, secretBytes(config), {
    issuer: config.tokenIssuer,
    audience: config.tokenAudience,
    algorithms: ["HS256"],
  });
  if (expectedType && payload.typ !== expectedType) {
    throw new Error("Realtime token type is not allowed");
  }
  const schema =
    payload.typ === "aide-realtime-owner"
      ? ownerRealtimeClaimsSchema
      : publicRealtimeClaimsSchema;
  return schema.parse(payload);
}

export function hashRealtimeBinding(value) {
  if (!value) return null;
  return createHash("sha256").update(String(value)).digest("hex");
}
