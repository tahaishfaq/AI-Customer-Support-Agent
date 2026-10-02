/**
 * Level 2 · P7 — REST API keys (read-only in v1). Owners/Admins create and revoke; the full key is
 * shown once. Requests authenticate with `Authorization: Bearer aide_sk_…` and only ever see their
 * own workspace.
 */

import prisma from "@/lib/prisma";
import { writeAuditEvent } from "@/lib/services/audit.service";
import { resolveWorkspaceForManager } from "@/lib/services/workspace-manager";
import { API_KEY_SCOPES, apiKeyMatches, generateApiKey, maskApiKey, parseApiKey } from "@/lib/api-keys/api-keys";

const MAX_KEYS_PER_WORKSPACE = 20;

function httpError(status, message, details = {}) {
  const err = new Error(message);
  err.status = status;
  err.details = details;
  return err;
}

function serializeKey(row) {
  return {
    id: row.id,
    name: row.name,
    masked: maskApiKey(row.prefix),
    scopes: Array.isArray(row.scopes) ? row.scopes : [],
    lastUsedAt: row.lastUsedAt,
    revokedAt: row.revokedAt,
    createdAt: row.createdAt,
  };
}

export async function listApiKeysForUser(userId) {
  const { workspace } = await resolveWorkspaceForManager(userId);
  const rows = await prisma.apiKey.findMany({ where: { workspaceId: workspace.id }, orderBy: { createdAt: "desc" } });
  return { keys: rows.map(serializeKey) };
}

export async function createApiKeyForUser(userId, { name }) {
  const { workspace } = await resolveWorkspaceForManager(userId);
  const cleanName = String(name || "").replace(/\s+/g, " ").trim().slice(0, 60);
  if (!cleanName) throw httpError(400, "Give the key a name");
  const active = await prisma.apiKey.count({ where: { workspaceId: workspace.id, revokedAt: null } });
  if (active >= MAX_KEYS_PER_WORKSPACE) throw httpError(400, `Up to ${MAX_KEYS_PER_WORKSPACE} active keys per workspace`);
  const { key, prefix, keyHash } = generateApiKey();
  const row = await prisma.apiKey.create({
    data: { workspaceId: workspace.id, name: cleanName, prefix, keyHash, scopes: [...API_KEY_SCOPES], createdByUserId: userId },
  });
  await writeAuditEvent({ adminId: userId, action: "api_key.create", targetType: "workspace", targetId: workspace.id, metadata: { keyId: row.id, name: cleanName } });
  return { key: serializeKey(row), secret: key };
}

export async function revokeApiKeyForUser(userId, keyId) {
  const { workspace } = await resolveWorkspaceForManager(userId);
  const row = await prisma.apiKey.findFirst({ where: { id: String(keyId), workspaceId: workspace.id } });
  if (!row) throw httpError(404, "Key not found");
  if (!row.revokedAt) {
    await prisma.apiKey.update({ where: { id: row.id }, data: { revokedAt: new Date() } });
    await writeAuditEvent({ adminId: userId, action: "api_key.revoke", targetType: "workspace", targetId: workspace.id, metadata: { keyId: row.id } });
  }
  return { ok: true };
}

const lastUsedWrites = new Map();

/**
 * Authenticate an API request. Unknown, malformed and revoked keys all get the same 401.
 * @returns {Promise<{ workspaceId: string, keyId: string, scopes: string[] }>}
 */
export async function authenticateApiKey(authorization) {
  const parsed = parseApiKey(authorization);
  const denied = () => httpError(401, "Invalid or revoked API key", { code: "API_KEY_INVALID" });
  if (!parsed) throw denied();
  const row = await prisma.apiKey.findUnique({ where: { prefix: parsed.prefix } });
  if (!row || row.revokedAt || !apiKeyMatches(parsed.key, row.keyHash)) throw denied();
  // lastUsedAt at most once a minute per key (no write on every request).
  const now = Date.now();
  if (now - (lastUsedWrites.get(row.id) || 0) > 60_000) {
    lastUsedWrites.set(row.id, now);
    prisma.apiKey.update({ where: { id: row.id }, data: { lastUsedAt: new Date(now) } }).catch(() => null);
  }
  return { workspaceId: row.workspaceId, keyId: row.id, scopes: Array.isArray(row.scopes) ? row.scopes : [] };
}
