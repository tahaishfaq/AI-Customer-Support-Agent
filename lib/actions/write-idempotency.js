/**
 * Stage 5.6 — WRITE idempotency keys + durable OK replay.
 *
 * Stable key: sha256(agent|conversation|action|argsHash)
 * Outbound HTTP reuses the same Idempotency-Key on transport retry.
 * Second invoke with same key returns cached OK without re-calling the API.
 */
import { createHash } from "node:crypto";
import prisma from "@/lib/prisma";

const DEFAULT_TTL_MS = 15 * 60 * 1000;
const MAX_BODY_CHARS = 8000;
const MAX_MODEL_CHARS = 4000;

export function writeIdempotencyTtlMs() {
  const n = Number(process.env.WRITE_IDEMPOTENCY_TTL_MS);
  if (!Number.isFinite(n)) return DEFAULT_TTL_MS;
  return Math.min(Math.max(Math.trunc(n), 60_000), 24 * 60 * 60_000);
}

/**
 * WRITE/DESTRUCTIVE when the action is marked idempotent (default true).
 * Non-idempotent writes must not be keyed/cached/retried.
 */
export function isWriteIdempotencyEligible({
  riskLevel = "READ",
  idempotent = true,
} = {}) {
  const risk = String(riskLevel || "READ").toUpperCase();
  if (risk !== "WRITE" && risk !== "DESTRUCTIVE") return false;
  if (idempotent === false) return false;
  return true;
}

/**
 * Deterministic Idempotency-Key material (hex, 64 chars).
 */
export function buildWriteIdempotencyKey({
  agentId,
  conversationId = null,
  actionId = null,
  mcpToolId = null,
  argsHash,
} = {}) {
  const cap = actionId
    ? `a:${String(actionId)}`
    : mcpToolId
      ? `m:${String(mcpToolId)}`
      : "unknown";
  const raw = [
    "write-v1",
    String(agentId || ""),
    String(conversationId || "none"),
    cap,
    String(argsHash || ""),
  ].join("|");
  return createHash("sha256").update(raw).digest("hex");
}

function clip(s, n) {
  const t = String(s || "");
  if (t.length <= n) return t;
  return `${t.slice(0, n)}…`;
}

function rowToReplay(row) {
  if (!row || row.status !== "OK") return null;
  if (row.expiresAt && new Date(row.expiresAt) <= new Date()) return null;
  return {
    ok: true,
    status: "OK",
    httpStatus: row.httpStatus ?? 200,
    durationMs: 0,
    errorCode: null,
    bodyText: row.bodyText || "",
    truncated: false,
    retried: false,
    idempotencyKey: row.idempotencyKey,
    idempotencyReplay: true,
    resultForModel: row.resultForModel || null,
  };
}

/**
 * Acquire IN_FLIGHT lease or return prior OK replay.
 * @returns {Promise<{ state: "acquired"|"replay"|"busy", replay?: object, key: string }>}
 */
export async function beginWriteIdempotency({
  idempotencyKey,
  agentId,
  conversationId = null,
  actionId = null,
  mcpToolId = null,
  argsHash,
} = {}) {
  const key = String(idempotencyKey || "").trim();
  if (!key) return { state: "acquired", key: "" };

  const now = new Date();
  const existing = await prisma.writeIdempotencyRecord.findUnique({
    where: { idempotencyKey: key },
  });

  if (existing) {
    if (existing.expiresAt <= now) {
      await prisma.writeIdempotencyRecord
        .delete({ where: { id: existing.id } })
        .catch(() => null);
    } else if (existing.status === "OK") {
      const replay = rowToReplay(existing);
      if (replay) return { state: "replay", replay, key };
    } else if (existing.status === "IN_FLIGHT") {
      // Brief wait for peer to finish, then re-check.
      await new Promise((r) => setTimeout(r, 120));
      const again = await prisma.writeIdempotencyRecord.findUnique({
        where: { idempotencyKey: key },
      });
      if (again?.status === "OK" && again.expiresAt > new Date()) {
        const replay = rowToReplay(again);
        if (replay) return { state: "replay", replay, key };
      }
      if (again?.status === "IN_FLIGHT" && again.expiresAt > new Date()) {
        return { state: "busy", key };
      }
      // ERROR or expired — fall through to reclaim
      if (again) {
        await prisma.writeIdempotencyRecord
          .delete({ where: { id: again.id } })
          .catch(() => null);
      }
    } else {
      // ERROR — allow retry with same key
      await prisma.writeIdempotencyRecord
        .delete({ where: { id: existing.id } })
        .catch(() => null);
    }
  }

  const expiresAt = new Date(Date.now() + writeIdempotencyTtlMs());
  try {
    await prisma.writeIdempotencyRecord.create({
      data: {
        idempotencyKey: key,
        agentId: String(agentId),
        conversationId: conversationId || null,
        actionId: actionId || null,
        mcpToolId: mcpToolId || null,
        argsHash: String(argsHash || ""),
        status: "IN_FLIGHT",
        expiresAt,
      },
    });
    return { state: "acquired", key };
  } catch (err) {
    if (err?.code !== "P2002") throw err;
    const row = await prisma.writeIdempotencyRecord.findUnique({
      where: { idempotencyKey: key },
    });
    if (row?.status === "OK" && row.expiresAt > new Date()) {
      const replay = rowToReplay(row);
      if (replay) return { state: "replay", replay, key };
    }
    return { state: "busy", key };
  }
}

/**
 * Persist successful WRITE result for replay.
 */
export async function completeWriteIdempotency(
  idempotencyKey,
  { httpStatus = 200, bodyText = "", resultForModel = null } = {}
) {
  const key = String(idempotencyKey || "").trim();
  if (!key) return;
  await prisma.writeIdempotencyRecord.updateMany({
    where: { idempotencyKey: key },
    data: {
      status: "OK",
      httpStatus: httpStatus ?? 200,
      errorCode: null,
      bodyText: clip(bodyText, MAX_BODY_CHARS),
      resultForModel: resultForModel
        ? clip(resultForModel, MAX_MODEL_CHARS)
        : null,
      expiresAt: new Date(Date.now() + writeIdempotencyTtlMs()),
    },
  });
}

/**
 * Mark failed attempt so the same key can retry later.
 */
export async function failWriteIdempotency(
  idempotencyKey,
  { errorCode = null, httpStatus = null } = {}
) {
  const key = String(idempotencyKey || "").trim();
  if (!key) return;
  await prisma.writeIdempotencyRecord.updateMany({
    where: { idempotencyKey: key },
    data: {
      status: "ERROR",
      errorCode: errorCode ? clip(errorCode, 120) : null,
      httpStatus: httpStatus ?? null,
      bodyText: null,
      resultForModel: null,
    },
  });
}
