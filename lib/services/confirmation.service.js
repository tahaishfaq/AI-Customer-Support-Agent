/**
 * F11-R2 / F14 / Stage 3+5.1+5.4 — Generic Action Confirmation Gateway (HTTP + MCP).
 * Stage 5.1: atomic approve/claim, PENDING uniqueness, capability re-check, expiry.
 * Stage 5.4: lifecycle phases, actor binding, stronger subject stamp.
 */
import { randomBytes } from "node:crypto";
import prisma from "@/lib/prisma";
import { hashArgs } from "@/lib/actions/identity";
import { getAgentForUser } from "@/lib/services/agent.service";

const DEFAULT_CONFIRMATION_TTL_MS = 10 * 60 * 1000;

/**
 * Conceptual lifecycle (DB status → phase):
 *   PENDING  → PENDING   (created; awaiting user)  [= CREATED+PENDING]
 *   APPROVED → CONFIRMED (user approved; not yet executed)
 *   CONSUMED → CONSUMED   (one-shot execute claimed)
 *   DENIED   → DENIED
 *   EXPIRED  → EXPIRED
 */
export const CONFIRMATION_LIFECYCLE = Object.freeze({
  PENDING: "PENDING",
  CONFIRMED: "CONFIRMED",
  CONSUMED: "CONSUMED",
  DENIED: "DENIED",
  EXPIRED: "EXPIRED",
});

/**
 * @param {string|null|undefined} status
 * @returns {string}
 */
export function statusToLifecyclePhase(status) {
  const s = String(status || "").toUpperCase();
  if (s === "APPROVED") return CONFIRMATION_LIFECYCLE.CONFIRMED;
  if (s === "PENDING") return CONFIRMATION_LIFECYCLE.PENDING;
  if (s === "CONSUMED") return CONFIRMATION_LIFECYCLE.CONSUMED;
  if (s === "DENIED") return CONFIRMATION_LIFECYCLE.DENIED;
  if (s === "EXPIRED") return CONFIRMATION_LIFECYCLE.EXPIRED;
  return s || "UNKNOWN";
}

/**
 * Stage 5.4 — actor must match conversation customerSubject when both present.
 * @returns {string|null} bound subject to stamp
 */
export function bindConfirmationActor({
  conversationSubject = null,
  evidenceSubject = null,
  existingSubject = null,
} = {}) {
  const conv = clip(conversationSubject, 320);
  const evidence = clip(evidenceSubject, 320);
  const existing = clip(existingSubject, 320);

  if (conv && evidence && evidence !== conv) {
    const err = httpError(
      403,
      "Confirmation actor does not match this conversation.",
      { code: "CONFIRMATION_ACTOR_MISMATCH" }
    );
    throw err;
  }
  if (conv && existing && existing !== conv) {
    const err = httpError(
      403,
      "Confirmation was bound to a different visitor.",
      { code: "CONFIRMATION_ACTOR_MISMATCH" }
    );
    throw err;
  }
  return conv || evidence || existing || null;
}

function confirmationTtlMs() {
  const n = Number(process.env.ACTIONS_CONFIRMATION_TTL_MS);
  if (!Number.isFinite(n)) return DEFAULT_CONFIRMATION_TTL_MS;
  return Math.min(Math.max(Math.trunc(n), 60_000), 60 * 60_000);
}

/** Documented default (env may override at runtime via confirmationTtlMs). */
const CONFIRMATION_TTL_MS = DEFAULT_CONFIRMATION_TTL_MS;

function httpError(status, message, details = {}) {
  const err = new Error(message);
  err.status = status;
  err.details = details;
  return err;
}

function newEvidenceId() {
  return `ev_${randomBytes(12).toString("hex")}`;
}

function clip(value, max = 200) {
  const s = String(value || "").trim();
  if (!s) return null;
  return s.length > max ? s.slice(0, max) : s;
}

function isUniqueViolation(err) {
  return (
    err?.code === "P2002" ||
    /unique constraint/i.test(String(err?.message || ""))
  );
}

/**
 * Normalize capability target for confirmation binding.
 * @param {{ actionId?: string|null, actionRevisionId?: string|null, mcpToolId?: string|null } | string} ref
 */
export function normalizeCapabilityRef(ref) {
  if (typeof ref === "string") {
    return { actionId: ref, actionRevisionId: null, mcpToolId: null };
  }
  const actionId = ref?.actionId ? String(ref.actionId) : null;
  const actionRevisionId = ref?.actionRevisionId ? String(ref.actionRevisionId) : null;
  const mcpToolId = ref?.mcpToolId ? String(ref.mcpToolId) : null;
  if (actionId && mcpToolId) {
    throw httpError(400, "Provide either actionId or mcpToolId, not both");
  }
  if (!actionId && !mcpToolId) {
    throw httpError(400, "actionId or mcpToolId is required");
  }
  if (actionRevisionId && !actionId) {
    throw httpError(400, "actionRevisionId requires actionId");
  }
  return { actionId, actionRevisionId, mcpToolId };
}

/**
 * Mark overdue PENDING (and optionally APPROVED) as EXPIRED.
 * @returns {Promise<number>} count updated
 */
export async function expireStalePendingConfirmations(conversationId = null) {
  const base = {
    expiresAt: { lt: new Date() },
    ...(conversationId ? { conversationId } : {}),
  };
  const pending = await prisma.actionConfirmation.updateMany({
    where: { ...base, status: "PENDING" },
    data: { status: "EXPIRED" },
  });
  const approved = await prisma.actionConfirmation.updateMany({
    where: { ...base, status: "APPROVED" },
    data: { status: "EXPIRED" },
  });
  return (pending.count || 0) + (approved.count || 0);
}

/**
 * Capability must still be enabled and belong to expected agent at claim time.
 */
async function loadCallableCapability(actionId, mcpToolId) {
  if (actionId) {
    const action = await prisma.agentAction.findUnique({
      where: { id: actionId },
      select: {
        id: true,
        agentId: true,
        enabled: true,
        name: true,
        description: true,
      },
    });
    if (!action?.enabled) return null;
    return {
      agentId: action.agentId,
      name: action.name,
      description: action.description,
    };
  }
  const tool = await prisma.agentMcpTool.findUnique({
    where: { id: mcpToolId },
    select: {
      id: true,
      enabled: true,
      functionName: true,
      description: true,
      server: { select: { agentId: true, enabled: true } },
    },
  });
  if (!tool?.enabled || !tool.server?.enabled) return null;
  return {
    agentId: tool.server.agentId,
    name: tool.functionName,
    description: tool.description,
  };
}

async function findPendingDuplicate(
  conversationId,
  actionId,
  mcpToolId,
  argsHash,
  actionRevisionId = null
) {
  return prisma.actionConfirmation.findFirst({
    where: {
      conversationId,
      argsHash,
      status: "PENDING",
      expiresAt: { gt: new Date() },
      ...(actionId ? { actionId } : { mcpToolId }),
      ...(actionId ? { actionRevisionId } : {}),
    },
    orderBy: { createdAt: "desc" },
  });
}

/**
 * Create PENDING confirmation for HTTP AgentAction or MCP AgentMcpTool.
 * Idempotent for same conversation + capability + argsHash while PENDING.
 */
export async function createPendingConfirmation(
  conversationId,
  capabilityRef,
  args = {}
) {
  if (!conversationId) {
    throw httpError(400, "conversationId is required");
  }

  const { actionId, actionRevisionId, mcpToolId } = normalizeCapabilityRef(capabilityRef);

  await expireStalePendingConfirmations(conversationId);

  const conversation = await prisma.conversation.findUnique({
    where: { id: conversationId },
    select: { id: true, agentId: true, customerSubject: true },
  });
  if (!conversation) {
    throw httpError(404, "Conversation not found");
  }

  const capability = await loadCallableCapability(actionId, mcpToolId);
  if (!capability) {
    throw httpError(404, actionId ? "Action not found" : "MCP tool not found");
  }
  if (conversation.agentId !== capability.agentId) {
    throw httpError(
      400,
      actionId
        ? "Action does not belong to this conversation's agent"
        : "MCP tool does not belong to this conversation's agent"
    );
  }

  const capabilityMeta = {
    name: capability.name,
    description: capability.description,
    agentId: capability.agentId,
  };

  const argsHash = hashArgs(args);
  const expiresAt = new Date(Date.now() + confirmationTtlMs());
  const userSubject = clip(conversation.customerSubject, 320);

  const existing = await findPendingDuplicate(
    conversationId,
    actionId,
    mcpToolId,
    argsHash,
    actionRevisionId
  );
  if (existing) {
    return serialize(existing, capabilityMeta);
  }

  try {
    const row = await prisma.actionConfirmation.create({
      data: {
        conversationId,
        actionId,
        actionRevisionId,
        mcpToolId,
        argsHash,
        status: "PENDING",
        expiresAt,
        ...(userSubject ? { userSubject } : {}),
      },
    });
    return serialize(row, capabilityMeta);
  } catch (err) {
    // Race: another request inserted the same PENDING unique key.
    if (!isUniqueViolation(err)) throw err;
    const raced = await findPendingDuplicate(
      conversationId,
      actionId,
      mcpToolId,
      argsHash,
      actionRevisionId
    );
    if (raced) return serialize(raced, capabilityMeta);
    throw err;
  }
}

/**
 * @param {"approve"|"deny"} decision
 * @param {{ userSubject?: string|null, userDisplay?: string|null, clientIp?: string|null }} [evidence]
 */
export async function resolveConfirmation(
  id,
  conversationId,
  decision,
  evidence = {}
) {
  if (!id || !conversationId) {
    throw httpError(400, "confirmation id and conversationId are required");
  }
  const nextStatus = decision === "deny" ? "DENIED" : "APPROVED";

  await expireStalePendingConfirmations(conversationId);

  const existing = await prisma.actionConfirmation.findFirst({
    where: { id, conversationId },
    include: {
      action: { select: { name: true, description: true } },
      mcpTool: { select: { functionName: true, description: true } },
      conversation: { select: { customerSubject: true, agentId: true } },
    },
  });
  if (!existing) {
    throw httpError(404, "Confirmation not found");
  }

  if (
    existing.status === "EXPIRED" ||
    existing.expiresAt.getTime() < Date.now()
  ) {
    if (existing.status !== "EXPIRED") {
      await prisma.actionConfirmation.updateMany({
        where: { id, conversationId, status: { in: ["PENDING", "APPROVED"] } },
        data: { status: "EXPIRED" },
      });
    }
    throw httpError(400, "Confirmation expired — ask again.", {
      code: "CONFIRMATION_EXPIRED",
    });
  }

  if (existing.status === nextStatus && existing.evidenceId) {
    return serialize(existing, metaFromRow(existing));
  }
  if (existing.status !== "PENDING") {
    throw httpError(400, `Confirmation is ${existing.status}`);
  }

  // Capability still callable at approve time (disabled MCP/HTTP cannot be confirmed).
  const stillOk = await loadCallableCapability(
    existing.actionId,
    existing.mcpToolId
  );
  if (!stillOk || stillOk.agentId !== existing.conversation?.agentId) {
    throw httpError(400, "Action is no longer available to confirm.", {
      code: "CONFIRMATION_CAPABILITY_GONE",
    });
  }

  // Stage 5.4 — actor binding (conversation subject wins; forged evidence rejected).
  const userSubject = bindConfirmationActor({
    conversationSubject: existing.conversation?.customerSubject,
    evidenceSubject: evidence.userSubject,
    existingSubject: existing.userSubject,
  });
  const userDisplay = clip(evidence.userDisplay, 200);
  const decidedIp = clip(evidence.clientIp, 64);
  const evidenceId = existing.evidenceId || newEvidenceId();

  // Atomic PENDING → APPROVED/DENIED (race-safe).
  const updated = await prisma.actionConfirmation.updateMany({
    where: {
      id,
      conversationId,
      status: "PENDING",
      expiresAt: { gt: new Date() },
    },
    data: {
      status: nextStatus,
      evidenceId,
      decidedAt: new Date(),
      ...(userSubject ? { userSubject } : {}),
      ...(userDisplay ? { userDisplay } : {}),
      ...(decidedIp ? { decidedIp } : {}),
    },
  });

  if (updated.count !== 1) {
    const again = await prisma.actionConfirmation.findFirst({
      where: { id, conversationId },
      include: {
        action: { select: { name: true, description: true } },
        mcpTool: { select: { functionName: true, description: true } },
      },
    });
    if (again?.status === nextStatus) {
      return serialize(again, metaFromRow(again));
    }
    throw httpError(400, `Confirmation is ${again?.status || "unavailable"}`);
  }

  const row = await prisma.actionConfirmation.findFirst({
    where: { id, conversationId },
    include: {
      action: { select: { name: true, description: true } },
      mcpTool: { select: { functionName: true, description: true } },
    },
  });
  return serialize(row, metaFromRow(row || existing));
}

export async function approveConfirmation(id, conversationId, evidence = {}) {
  return resolveConfirmation(id, conversationId, "approve", evidence);
}

export async function denyConfirmation(id, conversationId, evidence = {}) {
  return resolveConfirmation(id, conversationId, "deny", evidence);
}

/**
 * Find a still-valid APPROVED confirmation for this capability + args hash.
 */
export async function getApprovedConfirmation(
  conversationId,
  capabilityRef,
  argsHash,
  opts = {}
) {
  if (!conversationId || !argsHash) return null;
  const { actionId, actionRevisionId, mcpToolId } = normalizeCapabilityRef(capabilityRef);

  await expireStalePendingConfirmations(conversationId);

  const row = await prisma.actionConfirmation.findFirst({
    where: {
      conversationId,
      argsHash,
      status: "APPROVED",
      expiresAt: { gt: new Date() },
      ...(actionId ? { actionId } : { mcpToolId }),
      ...(actionId ? { actionRevisionId } : {}),
    },
    orderBy: { createdAt: "desc" },
    include: {
      action: { select: { name: true, description: true, agentId: true, enabled: true } },
      mcpTool: {
        select: {
          functionName: true,
          description: true,
          enabled: true,
          server: { select: { agentId: true, enabled: true } },
        },
      },
      conversation: { select: { agentId: true, customerSubject: true } },
    },
  });

  if (!row) return null;

  const capabilityAgentId =
    row.action?.agentId || row.mcpTool?.server?.agentId || null;
  const conversationAgentId = row.conversation?.agentId || null;
  const capabilityEnabled = row.action
    ? row.action.enabled === true
    : row.mcpTool?.enabled === true && row.mcpTool?.server?.enabled === true;

  if (
    !capabilityEnabled ||
    !capabilityAgentId ||
    !conversationAgentId ||
    capabilityAgentId !== conversationAgentId
  ) {
    return null;
  }
  if (
    opts.expectedAgentId &&
    String(opts.expectedAgentId) !== String(conversationAgentId)
  ) {
    return null;
  }

  // Stage 5.4 — confirmation actor must still match conversation subject.
  const convSub = clip(row.conversation?.customerSubject, 320);
  const confSub = clip(row.userSubject, 320);
  if (convSub && confSub && convSub !== confSub) {
    return null;
  }

  return serialize(row, metaFromRow(row));
}

/**
 * Atomically claim an APPROVED confirmation (→ CONSUMED) so it cannot be replayed.
 * Optimistic lock via updateMany(status=APPROVED) — safe under parallel claims
 * without interactive transactions (Neon pooler-friendly).
 */
export async function claimApprovedConfirmation(
  conversationId,
  capabilityRef,
  argsHash,
  opts = {}
) {
  const approved = await getApprovedConfirmation(
    conversationId,
    capabilityRef,
    argsHash,
    opts
  );
  if (!approved?.id) return null;

  const claimed = await prisma.actionConfirmation.updateMany({
    where: {
      id: approved.id,
      status: "APPROVED",
      expiresAt: { gt: new Date() },
    },
    data: { status: "CONSUMED" },
  });
  if (claimed.count !== 1) return null;
  return {
    ...approved,
    status: "CONSUMED",
    lifecyclePhase: statusToLifecyclePhase("CONSUMED"),
  };
}

/**
 * Owner audit: recent confirmations for an agent (F14-B).
 */
export async function listConfirmationsForAgent(agentId, userId, { take = 30 } = {}) {
  await getAgentForUser(agentId, userId);
  const limit = Math.min(Math.max(Number(take) || 30, 1), 100);

  const rows = await prisma.actionConfirmation.findMany({
    where: {
      OR: [
        { action: { agentId } },
        { mcpTool: { server: { agentId } } },
      ],
    },
    orderBy: [{ decidedAt: "desc" }, { createdAt: "desc" }],
    take: limit,
    include: {
      action: { select: { id: true, name: true } },
      mcpTool: { select: { id: true, functionName: true } },
      conversation: {
        select: { id: true, customerSubject: true },
      },
    },
  });

  return rows.map((row) =>
    serialize(row, metaFromRow(row), {
      conversationId: row.conversationId,
      conversationSubject: row.conversation?.customerSubject || null,
    })
  );
}

function metaFromRow(row) {
  if (row.action) {
    return {
      name: row.action.name,
      description: row.action.description,
    };
  }
  if (row.mcpTool) {
    return {
      name: row.mcpTool.functionName,
      description: row.mcpTool.description,
    };
  }
  return { name: null, description: null };
}

function serialize(row, meta = null, extra = {}) {
  const status = row.status;
  return {
    id: row.id,
    conversationId: row.conversationId,
    actionId: row.actionId || null,
    mcpToolId: row.mcpToolId || null,
    actionName:
      meta?.name ||
      row.action?.name ||
      row.mcpTool?.functionName ||
      null,
    actionDescription:
      meta?.description ||
      row.action?.description ||
      row.mcpTool?.description ||
      null,
    argsHash: row.argsHash,
    status,
    /** Stage 5.4 conceptual phase (APPROVED → CONFIRMED). */
    lifecyclePhase: statusToLifecyclePhase(status),
    evidenceId: row.evidenceId || null,
    userSubject: row.userSubject || null,
    userDisplay: row.userDisplay || null,
    decidedAt: row.decidedAt || null,
    decidedIp: row.decidedIp || null,
    expiresAt: row.expiresAt,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    ...extra,
  };
}

export { CONFIRMATION_TTL_MS, confirmationTtlMs };
