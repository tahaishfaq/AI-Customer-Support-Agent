import { z } from "zod";
import {
  ACTION_HTTP_METHODS,
  ACTION_RISK_LEVELS,
  clampActionTimeoutMs,
  isValidActionName,
  normalizeActionName,
} from "../actions/action-config.js";
import {
  ACTION_IDENTITY_MODES,
  syncIdentityFields,
} from "../actions/identity-mode.js";
import {
  ACTION_ACCESS_CLASSES,
  syncAccessClassFields,
} from "../actions/access-class.js";

function zodErrorDetails(error) {
  const details = {};
  for (const issue of error.issues) {
    const key = issue.path.join(".") || "form";
    details[key] = issue.message;
  }
  return details;
}

const jsonObjectSchema = z
  .union([z.record(z.string(), z.unknown()), z.null()])
  .optional()
  .transform((v) => (v === undefined ? undefined : v));

const methodSchema = z
  .string()
  .transform((v) => String(v || "GET").toUpperCase())
  .refine((v) => ACTION_HTTP_METHODS.includes(v), {
    message: "Method must be GET or POST",
  });

const nameSchema = z
  .string()
  .trim()
  .min(2, "Name is required")
  .max(64, "Name is too long")
  .transform(normalizeActionName)
  .refine((v) => isValidActionName(v), {
    message: "Use lowercase letters, numbers, underscores (e.g. get_order_status)",
  });

const urlTemplateSchema = z
  .string()
  .trim()
  .min(8, "URL template is required")
  .max(2000, "URL template is too long")
  .refine((v) => /^https:\/\//i.test(v) || /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?\//i.test(v), {
    message: "URL must start with https:// (http://localhost allowed for local demo)",
  })
  .refine((v) => !/\s/.test(v), { message: "URL cannot contain spaces" });

const riskLevelSchema = z
  .string()
  .transform((v) => String(v || "READ").toUpperCase())
  .refine((v) => ACTION_RISK_LEVELS.includes(v), {
    message: "riskLevel must be READ, WRITE, or DESTRUCTIVE",
  });

const identityModeSchema = z
  .string()
  .transform((v) => String(v || "NONE").toUpperCase())
  .refine((v) => ACTION_IDENTITY_MODES.includes(v), {
    message: "identityMode must be NONE, OWNER_KEY, or END_USER_TOKEN",
  });

const accessClassSchema = z
  .string()
  .transform((v) => String(v || "PUBLIC_READ").toUpperCase())
  .refine((v) => ACTION_ACCESS_CLASSES.includes(v), {
    message:
      "accessClass must be PUBLIC_READ, GUEST_LOOKUP, ACCOUNT_READ, ACCOUNT_WRITE, or DESTRUCTIVE",
  });

const redesignFields = {
  credentialId: z.string().trim().min(1).nullable().optional(),
  riskLevel: riskLevelSchema.optional().default("READ"),
  requiresConfirmation: z.boolean().optional().default(false),
  requiresIdentity: z.boolean().optional().default(false),
  identityMode: identityModeSchema.optional(),
  accessClass: accessClassSchema.optional(),
  idempotent: z.boolean().optional().default(true),
};

export const createAgentActionSchema = z
  .object({
    name: nameSchema,
    description: z.string().trim().min(1, "Description is required").max(500),
    method: methodSchema.default("GET"),
    urlTemplate: urlTemplateSchema,
    headersJson: jsonObjectSchema,
    inputSchemaJson: jsonObjectSchema,
    outputSchemaJson: jsonObjectSchema,
    enabled: z.boolean().optional().default(true),
    timeoutMs: z
      .number()
      .int()
      .optional()
      .transform((v) => clampActionTimeoutMs(v ?? 8000)),
    ...redesignFields,
  })
  .transform((data) => {
    const withAccess = syncAccessClassFields(data);
    const synced = syncIdentityFields(withAccess);
    return { ...data, ...withAccess, ...synced };
  });

export const updateAgentActionSchema = z
  .object({
    name: nameSchema.optional(),
    description: z.string().trim().min(1).max(500).optional(),
    method: methodSchema.optional(),
    urlTemplate: urlTemplateSchema.optional(),
    headersJson: jsonObjectSchema,
    inputSchemaJson: jsonObjectSchema,
    outputSchemaJson: jsonObjectSchema,
    enabled: z.boolean().optional(),
    timeoutMs: z
      .number()
      .int()
      .optional()
      .transform((v) => (v === undefined ? undefined : clampActionTimeoutMs(v))),
    credentialId: z.string().trim().min(1).nullable().optional(),
    riskLevel: riskLevelSchema.optional(),
    requiresConfirmation: z.boolean().optional(),
    requiresIdentity: z.boolean().optional(),
    identityMode: identityModeSchema.optional(),
    accessClass: accessClassSchema.optional(),
    idempotent: z.boolean().optional(),
  })
  .refine(
    (data) =>
      data.name !== undefined ||
      data.description !== undefined ||
      data.method !== undefined ||
      data.urlTemplate !== undefined ||
      data.headersJson !== undefined ||
      data.inputSchemaJson !== undefined ||
      data.outputSchemaJson !== undefined ||
      data.enabled !== undefined ||
      data.timeoutMs !== undefined ||
      data.credentialId !== undefined ||
      data.riskLevel !== undefined ||
      data.requiresConfirmation !== undefined ||
      data.requiresIdentity !== undefined ||
      data.identityMode !== undefined ||
      data.accessClass !== undefined ||
      data.idempotent !== undefined,
    { message: "At least one field is required", path: ["form"] }
  )
  .transform((data) => {
    if (
      data.accessClass === undefined &&
      data.identityMode === undefined &&
      data.requiresIdentity === undefined &&
      data.riskLevel === undefined
    ) {
      return data;
    }
    const withAccess = syncAccessClassFields(data);
    const synced = syncIdentityFields(withAccess);
    return { ...data, ...withAccess, ...synced };
  });

export const testAgentActionSchema = z.object({
  args: z.record(z.string(), z.unknown()).optional().default({}),
});

export { zodErrorDetails };
