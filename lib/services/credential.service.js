/**
 * F11-R1 — workspace-scoped ActionCredential CRUD (ciphertext never leaves server).
 */
import prisma from "@/lib/prisma";
import { canManageAgentActions } from "@/lib/actions/action-config";
import { decryptSecret, encryptSecret } from "@/lib/actions/secrets";
import { getAgentForUser } from "@/lib/services/agent.service";

import { applyCredentialToHeaders } from "@/lib/actions/credential-apply";

function httpError(status, message, details = {}) {
  const err = new Error(message);
  err.status = status;
  err.details = details;
  return err;
}

async function requireManagedAgent(agentId, userId) {
  const agent = await getAgentForUser(agentId, userId);
  if (!canManageAgentActions({ userId, agent })) {
    throw httpError(403, "Not allowed to manage credentials for this agent");
  }
  if (!agent.workspaceId) {
    throw httpError(400, "Agent has no workspace");
  }
  return agent;
}

export function serializeCredentialForOwner(cred) {
  if (!cred) return null;
  return {
    id: cred.id,
    workspaceId: cred.workspaceId,
    name: cred.name,
    type: cred.type,
    headerName: cred.headerName || null,
    keyVersion: cred.keyVersion,
    revokedAt: cred.revokedAt,
    lastRotatedAt: cred.lastRotatedAt,
    createdAt: cred.createdAt,
    updatedAt: cred.updatedAt,
    hasSecret: Boolean(cred.ciphertext),
  };
}

export async function listCredentialsForAgent(agentId, userId) {
  const agent = await requireManagedAgent(agentId, userId);
  const rows = await prisma.actionCredential.findMany({
    where: { workspaceId: agent.workspaceId },
    orderBy: { createdAt: "asc" },
  });
  return rows.map(serializeCredentialForOwner);
}

export async function createCredentialForAgent(agentId, userId, data) {
  const agent = await requireManagedAgent(agentId, userId);
  const name = String(data.name || "")
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, "_");
  if (!/^[a-z][a-z0-9_]{1,63}$/.test(name)) {
    throw httpError(400, "Invalid credential name");
  }
  const type = data.type === "API_KEY_HEADER" ? "API_KEY_HEADER" : "BEARER";
  const headerName =
    type === "API_KEY_HEADER"
      ? String(data.headerName || "X-API-KEY").trim().slice(0, 64) || "X-API-KEY"
      : null;
  const ciphertext = encryptSecret(data.secret);

  try {
    const cred = await prisma.actionCredential.create({
      data: {
        workspaceId: agent.workspaceId,
        name,
        type,
        headerName,
        ciphertext,
        keyVersion: 1,
      },
    });
    return serializeCredentialForOwner(cred);
  } catch (err) {
    if (err?.code === "P2002") {
      throw httpError(409, "A credential with this name already exists");
    }
    throw err;
  }
}

export async function rotateCredentialForAgent(agentId, credentialId, userId, { secret }) {
  const agent = await requireManagedAgent(agentId, userId);
  const existing = await prisma.actionCredential.findFirst({
    where: { id: credentialId, workspaceId: agent.workspaceId },
  });
  if (!existing) throw httpError(404, "Credential not found");
  if (existing.revokedAt) throw httpError(400, "Credential is revoked");

  const ciphertext = encryptSecret(secret);
  const cred = await prisma.actionCredential.update({
    where: { id: credentialId },
    data: {
      ciphertext,
      keyVersion: existing.keyVersion + 1,
      lastRotatedAt: new Date(),
    },
  });
  return serializeCredentialForOwner(cred);
}

export async function revokeCredentialForAgent(agentId, credentialId, userId) {
  const agent = await requireManagedAgent(agentId, userId);
  const existing = await prisma.actionCredential.findFirst({
    where: { id: credentialId, workspaceId: agent.workspaceId },
  });
  if (!existing) throw httpError(404, "Credential not found");

  const cred = await prisma.actionCredential.update({
    where: { id: credentialId },
    data: { revokedAt: new Date() },
  });

  // Detach from actions so chat fails closed until re-attached
  await prisma.agentAction.updateMany({
    where: { credentialId, agentId },
    data: { credentialId: null },
  });

  return serializeCredentialForOwner(cred);
}

/**
 * Load + decrypt credential for executor. Fail closed if revoked/missing.
 * @returns {{ id: string, name: string, type: string, headerName: string|null, plaintext: string, keyVersion: number }}
 */
export async function loadDecryptedCredential(credentialId, workspaceId) {
  if (!credentialId) return null;
  const cred = await prisma.actionCredential.findFirst({
    where: { id: credentialId, workspaceId },
  });
  if (!cred) {
    throw httpError(400, "Credential not found", { code: "CREDENTIAL_MISSING" });
  }
  if (cred.revokedAt) {
    throw httpError(400, "Credential revoked", { code: "CREDENTIAL_REVOKED" });
  }
  const plaintext = decryptSecret(cred.ciphertext);
  return {
    id: cred.id,
    name: cred.name,
    type: cred.type,
    headerName: cred.headerName,
    plaintext,
    keyVersion: cred.keyVersion,
  };
}

export { applyCredentialToHeaders };
