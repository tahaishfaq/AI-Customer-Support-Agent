import { createHash } from "node:crypto";
import prisma from "@/lib/prisma";
import { canManageAgentActions } from "@/lib/actions/action-config";
import { getAgentForUser } from "@/lib/services/agent.service";
import { normalizeTaskDefinition } from "@/lib/orchestrator/task-contract";

function httpError(status, message, details = {}) {
  const error = new Error(message);
  error.status = status;
  error.details = details;
  return error;
}

async function requireManagedAgent(agentId, userId) {
  const agent = await getAgentForUser(agentId, userId);
  if (!canManageAgentActions({ userId, agent })) {
    throw httpError(403, "Not allowed to manage tasks");
  }
  return agent;
}

async function requireTask(agentId, taskId, userId) {
  const agent = await requireManagedAgent(agentId, userId);
  const task = await prisma.agentTask.findFirst({ where: { id: taskId, agentId } });
  if (!task) throw httpError(404, "Task not found");
  return { agent, task };
}

function hashConfig(value) {
  return createHash("sha256").update(JSON.stringify(value)).digest("hex");
}

function serializeRevision(row) {
  return {
    id: row.id,
    taskId: row.taskId,
    revision: row.revision,
    state: row.state,
    configurationHash: row.configurationHash,
    supportedIntents: row.supportedIntents,
    requiredIdentity: row.requiredIdentity,
    allowedActionRevisions: row.allowedActionRevisions,
    steps: row.steps,
    dependencies: row.dependencies,
    outputMappings: row.outputMappings,
    confirmationCheckpoints: row.confirmationCheckpoints,
    failurePolicy: row.failurePolicy,
    budgets: row.budgets,
    publishedAt: row.publishedAt,
    retiredAt: row.retiredAt,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

function revisionInput(body) {
  const normalized = normalizeTaskDefinition(body);
  const supportedIntents = Array.isArray(body.supportedIntents)
    ? body.supportedIntents.map((intent) => String(intent).trim()).filter(Boolean)
    : [];
  const requiredIdentity = normalized.requiredIdentity;
  if (!["NONE", "OWNER_KEY", "END_USER_TOKEN"].includes(requiredIdentity)) {
    throw httpError(400, "Invalid task identity requirement");
  }
  const input = {
    supportedIntents,
    requiredIdentity,
    allowedActionRevisions: normalized.allowedActionRevisions,
    steps: normalized.steps,
    dependencies: body.dependencies || null,
    outputMappings: body.outputMappings || null,
    confirmationCheckpoints: body.confirmationCheckpoints || null,
    failurePolicy: normalized.failurePolicy,
    budgets: normalized.budgets,
  };
  return { normalized, input, configurationHash: hashConfig(input) };
}

export async function createTaskForAgent(agentId, userId, body) {
  await requireManagedAgent(agentId, userId);
  if (!String(body?.name || "").trim()) throw httpError(400, "Task name is required");
  try {
    return await prisma.agentTask.create({
      data: {
        agentId,
        name: String(body.name).trim(),
        description: String(body.description || "").trim(),
      },
    });
  } catch (error) {
    if (error?.code === "P2002") throw httpError(409, "A task with this name already exists");
    throw error;
  }
}

export async function listTasksForAgent(agentId, userId) {
  await requireManagedAgent(agentId, userId);
  return prisma.agentTask.findMany({ where: { agentId }, orderBy: { createdAt: "asc" } });
}

export async function listTaskRevisions(agentId, taskId, userId) {
  await requireTask(agentId, taskId, userId);
  const rows = await prisma.taskRevision.findMany({
    where: { taskId },
    orderBy: { revision: "desc" },
  });
  return rows.map(serializeRevision);
}

export async function createTaskDraftRevision(agentId, taskId, userId, body) {
  await requireTask(agentId, taskId, userId);
  const { input, configurationHash } = revisionInput(body);
  const latest = await prisma.taskRevision.findFirst({
    where: { taskId },
    orderBy: { revision: "desc" },
    select: { revision: true },
  });
  const row = await prisma.$transaction(async (tx) => {
    const created = await tx.taskRevision.create({
      data: {
        taskId,
        revision: (latest?.revision || 0) + 1,
        state: "DRAFT",
        configurationHash,
        ...input,
      },
    });
    await tx.agentTask.update({
      where: { id: taskId },
      data: { currentDraftRevisionId: created.id },
    });
    return created;
  });
  return serializeRevision(row);
}

export async function publishTaskRevision(agentId, taskId, revisionId, userId) {
  const { task } = await requireTask(agentId, taskId, userId);
  const revision = await prisma.taskRevision.findFirst({ where: { id: revisionId, taskId } });
  if (!revision) throw httpError(404, "Task revision not found");
  if (revision.state === "RETIRED") throw httpError(409, "Retired task revision cannot be published");
  const actionIds = Array.isArray(revision.allowedActionRevisions)
    ? revision.allowedActionRevisions.map(String)
    : [];
  const actions = await prisma.actionRevision.findMany({
    where: {
      id: { in: actionIds },
      state: "PUBLISHED",
      action: { agentId },
    },
    select: { id: true },
  });
  if (actions.length !== new Set(actionIds).size) {
    throw httpError(409, "Every task action must be a published action revision", {
      code: "TASK_ACTION_REVISION_INVALID",
    });
  }
  const published = await prisma.$transaction(async (tx) => {
    await tx.taskRevision.updateMany({
      where: { taskId, state: "PUBLISHED", id: { not: revisionId } },
      data: { state: "RETIRED", retiredAt: new Date() },
    });
    const row = await tx.taskRevision.update({
      where: { id: revisionId },
      data: { state: "PUBLISHED", publishedAt: new Date(), retiredAt: null },
    });
    await tx.agentTask.update({
      where: { id: task.id },
      data: { publishedRevisionId: row.id, currentDraftRevisionId: null },
    });
    return row;
  });
  return serializeRevision(published);
}
