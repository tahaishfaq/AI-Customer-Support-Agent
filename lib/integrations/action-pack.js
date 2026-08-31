/**
 * F11-R5 — Action packs: create starter AgentActions from templates (idempotent by name).
 */
import {
  ACTION_TEMPLATES,
  serializeActionForOwner,
} from "@/lib/actions/action-config";
import { extractFrozenHost } from "@/lib/actions/frozen-host";
import {
  buildUniversalSlotTemplates,
  getUniversalBusiness,
  parseUniversalPackId,
} from "@/lib/integrations/universal-businesses";
import { syncAccessClassFields } from "@/lib/actions/access-class";
import prisma from "@/lib/prisma";

/** packId → template ids */
export const ACTION_PACKS = Object.freeze({
  demo_order: ["demo_order_status"],
  brandly: ["brandly_list_campaigns", "brandly_campaign_status"],
  brandly_demo: ["demo_campaign_status"],
  booking: ["get_appointment"],
  ticket: ["create_support_ticket"],
  subscription: ["get_subscription"],
  shopify_lite: ["shopify_get_order"],
  hubspot_lite: ["hubspot_create_ticket"],
  /** F13-T0 — six editable starters for an embed site */
  site_demo_v1: [
    "site_list_items",
    "site_get_item",
    "site_order_status",
    "site_search_help",
    "site_create_ticket",
    "site_update_preference",
  ],
});

/** App origin for rewriting local demo URL templates on pack install. */
function demoAppOrigin() {
  const raw =
    process.env.NEXT_PUBLIC_APP_URL ||
    process.env.AUTH_URL ||
    "http://127.0.0.1:3000";
  return String(raw).replace(/\/$/, "");
}

/**
 * Rewrite only Aide local demo fixtures (/api/demo/…) to the running app origin.
 * Leave Brandly / other localhost ports (e.g. :8000) unchanged.
 */
function resolvePackUrlTemplate(urlTemplate) {
  const origin = demoAppOrigin();
  const raw = String(urlTemplate || "");
  if (!/\/api\/demo\//i.test(raw)) return raw;
  return raw.replace(/^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?/i, origin);
}

function httpError(status, message, details = {}) {
  const err = new Error(message);
  err.status = status;
  err.details = details;
  return err;
}

async function createActionsFromSlotTemplates({
  agentId,
  workspaceId,
  packId,
  credentialId,
  templates,
}) {
  if (credentialId && workspaceId) {
    const cred = await prisma.actionCredential.findFirst({
      where: { id: credentialId, workspaceId, revokedAt: null },
      select: { id: true },
    });
    if (!cred) {
      throw httpError(400, "Credential not found in this workspace");
    }
  }

  const existing = await prisma.agentAction.findMany({
    where: { agentId },
    select: { name: true },
  });
  const existingNames = new Set(existing.map((a) => a.name));

  const created = [];
  const skipped = [];

  for (const template of templates) {
    if (!template?.name) {
      skipped.push(template?.slot || "unknown");
      continue;
    }
    if (existingNames.has(template.name)) {
      skipped.push(template.name);
      continue;
    }

    const urlTemplate = resolvePackUrlTemplate(template.urlTemplate);
    const access = syncAccessClassFields({
      accessClass: template.accessClass,
      name: template.name,
      description: template.description,
      identityMode:
        template.identityMode ||
        (template.requiresIdentity ? "END_USER_TOKEN" : "NONE"),
      riskLevel: template.riskLevel || "READ",
      requiresIdentity: Boolean(template.requiresIdentity),
      requiresConfirmation: Boolean(template.requiresConfirmation),
    });
    const action = await prisma.agentAction.create({
      data: {
        agentId,
        name: template.name,
        description: template.description,
        method: template.method,
        urlTemplate,
        frozenHost: extractFrozenHost(urlTemplate),
        headersJson: template.headersJson ?? undefined,
        inputSchemaJson: template.inputSchemaJson ?? undefined,
        enabled: true,
        timeoutMs: 8000,
        credentialId: credentialId || null,
        riskLevel: access.riskLevel,
        requiresConfirmation: access.requiresConfirmation,
        requiresIdentity: access.requiresIdentity,
        identityMode: access.identityMode,
        accessClass: access.accessClass,
        idempotent: template.idempotent !== false,
      },
    });
    existingNames.add(template.name);
    created.push(serializeActionForOwner(action));
  }

  return { packId, created, skipped };
}

/**
 * Create starter actions from a named pack. Skips names that already exist.
 * Also supports `universal:B11` style packs (F11-U Sprint A).
 * @returns {{ created: Array, skipped: string[], packId: string }}
 */
export async function createActionPack({
  agentId,
  workspaceId,
  packId,
  credentialId = null,
}) {
  const businessId = parseUniversalPackId(packId);
  if (businessId) {
    const business = getUniversalBusiness(businessId);
    if (!business) {
      throw httpError(400, `Unknown universal business: ${businessId}`);
    }
    const templates = buildUniversalSlotTemplates(business);
    return createActionsFromSlotTemplates({
      agentId,
      workspaceId,
      packId,
      credentialId,
      templates,
    });
  }

  const templateIds = ACTION_PACKS[packId];
  if (!templateIds) {
    throw httpError(400, `Unknown packId: ${packId}`, {
      packId: `Expected one of: ${Object.keys(ACTION_PACKS).join(", ")}, or universal:B01…B50`,
    });
  }

  const templates = [];
  for (const tid of templateIds) {
    const template = ACTION_TEMPLATES.find((t) => t.id === tid);
    if (template) templates.push(template);
  }

  return createActionsFromSlotTemplates({
    agentId,
    workspaceId,
    packId,
    credentialId,
    templates,
  });
}
