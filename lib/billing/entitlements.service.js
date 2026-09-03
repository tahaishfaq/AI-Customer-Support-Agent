import prisma from "@/lib/prisma";
import { getBillingSnapshot } from "@/lib/billing/subscription.service";
import { getPlatformSettings } from "@/lib/services/platform-settings.service";

/**
 * Effective caps for a user: plan entitlements when billing unlocked, else platform defaults.
 */
export async function resolvePlanLimits(userId, role = "USER") {
  const billing = await getBillingSnapshot(userId, role);
  const settings = await getPlatformSettings();

  if (billing.unlocked && billing.entitlements) {
    return {
      source: "plan",
      maxWorkspaces: billing.entitlements.maxWorkspaces,
      maxAgentsPerWorkspace: billing.entitlements.maxAgentsPerWorkspace,
      maxConversationsPerMonth: billing.entitlements.maxConversationsPerMonth,
      planType: billing.entitlements.planType,
      status: billing.status,
    };
  }

  return {
    source: "platform",
    maxWorkspaces: settings.maxWorkspacesPerUser,
    maxAgentsPerWorkspace: settings.maxAgentsPerWorkspace,
    maxConversationsPerMonth: null,
    planType: null,
    status: billing.status,
  };
}

export async function getUserRole(userId) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { role: true },
  });
  return user?.role || "USER";
}

function limitExceededMessage(kind, limit) {
  if (limit <= 0) return null;
  if (kind === "workspace") {
    return `Your plan allows at most ${limit} workspace${limit === 1 ? "" : "s"}. Upgrade your plan for more.`;
  }
  return `This workspace allows at most ${limit} agent${limit === 1 ? "" : "s"} on your plan. Upgrade for more.`;
}

export async function assertCanCreateWorkspace(userId, role) {
  if (role === "ADMIN") return;

  const billing = await getBillingSnapshot(userId, role);
  if (billing.status === "PAST_DUE") {
    const err = new Error(
      "Your subscription is past due. Update payment in Settings → Billing before creating workspaces."
    );
    err.status = 402;
    err.code = "billing_past_due";
    throw err;
  }

  const limits = await resolvePlanLimits(userId, role);
  if (!limits.maxWorkspaces || limits.maxWorkspaces <= 0) return;

  const count = await prisma.workspace.count({ where: { userId } });
  if (count >= limits.maxWorkspaces) {
    const err = new Error(limitExceededMessage("workspace", limits.maxWorkspaces));
    err.status = 402;
    err.code = "plan_limit_reached";
    err.details = { kind: "workspace", limit: limits.maxWorkspaces, used: count };
    throw err;
  }
}

export async function assertCanCreateAgent(userId, workspaceId, role) {
  if (role === "ADMIN") return;

  const billing = await getBillingSnapshot(userId, role);
  if (billing.status === "PAST_DUE") {
    const err = new Error(
      "Your subscription is past due. Update payment before creating agents."
    );
    err.status = 402;
    err.code = "billing_past_due";
    throw err;
  }

  const limits = await resolvePlanLimits(userId, role);
  if (!limits.maxAgentsPerWorkspace || limits.maxAgentsPerWorkspace <= 0) return;

  const count = await prisma.agent.count({ where: { workspaceId } });
  if (count >= limits.maxAgentsPerWorkspace) {
    const err = new Error(
      limitExceededMessage("agent", limits.maxAgentsPerWorkspace)
    );
    err.status = 402;
    err.code = "plan_limit_reached";
    err.details = {
      kind: "agent",
      limit: limits.maxAgentsPerWorkspace,
      used: count,
    };
    throw err;
  }
}

export function subscriptionAllowsCreates(status) {
  return status === "ACTIVE";
}
