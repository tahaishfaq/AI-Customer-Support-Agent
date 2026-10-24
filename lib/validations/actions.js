import { z } from "zod";
import {
  ACTION_HTTP_METHODS,
  ACTION_PROTOCOLS,
  ACTION_RISK_LEVELS,
  clampActionTimeoutMs,
  isValidActionName,
  normalizeActionName,
  validateMethodRiskAccess,
} from "../actions/action-config.js";
import {
  ACTION_IDENTITY_MODES,
  syncIdentityFields,
} from "../actions/identity-mode.js";
import {
  ACTION_ACCESS_CLASSES,
  syncAccessClassFields,
} from "../actions/access-class.js";
import {
  enforceGraphQLRiskPolicy,
  validateGraphQLOperationDocument,
} from "../actions/graphql-adapter.js";
import { detectUnsafeGraphqlBodyInjection } from "../actions/graphql-legacy.js";
import { validatePaginationConfig } from "../actions/pagination.js";

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

const requestContentTypeSchema = z
  .string()
  .trim()
  .toLowerCase()
  .refine(
    (value) =>
      value === "application/json" ||
      value === "application/x-www-form-urlencoded",
    { message: "Request content type must be JSON or form-urlencoded" }
  );

const methodSchema = z
  .string()
  .transform((v) => String(v || "GET").toUpperCase())
  .refine((v) => ACTION_HTTP_METHODS.includes(v), {
    message: "Method must be GET, POST, PUT, PATCH, or DELETE",
  });

const protocolSchema = z
  .string()
  .transform((v) => String(v || "REST_JSON").toUpperCase())
  .refine((v) => ACTION_PROTOCOLS.includes(v), {
    message: "protocol must be REST_JSON, GRAPHQL, or XML",
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
  connectionId: z.string().trim().min(1).nullable().optional(),
  credentialId: z.string().trim().min(1).nullable().optional(),
  riskLevel: riskLevelSchema.optional().default("READ"),
  requiresConfirmation: z.boolean().optional().default(false),
  requiresIdentity: z.boolean().optional().default(false),
  identityMode: identityModeSchema.optional(),
  accessClass: accessClassSchema.optional(),
  idempotent: z.boolean().optional().default(true),
};

const protocolFields = {
  protocol: protocolSchema.optional().default("REST_JSON"),
  graphqlOperation: z.string().trim().max(20_000).nullable().optional(),
  graphqlOperationName: z.string().trim().max(120).nullable().optional(),
  resultInstructions: z.string().trim().max(1000).nullable().optional(),
  paginationJson: jsonObjectSchema,
};

function applyActionPolicyChecks(data, ctx) {
  const methodCheck = validateMethodRiskAccess({
    method: data.method || "GET",
    riskLevel: data.riskLevel || "READ",
    accessClass: data.accessClass || "PUBLIC_READ",
  });
  if (!methodCheck.ok) {
    ctx.addIssue({ code: "custom", message: methodCheck.error, path: ["method"] });
  }

  const unsafe = detectUnsafeGraphqlBodyInjection(data);
  if (unsafe.unsafe) {
    ctx.addIssue({
      code: "custom",
      message: unsafe.reason,
      path: ["requestBodyTemplate"],
    });
  }

  const protocol = String(data.protocol || "REST_JSON").toUpperCase();
  if (protocol === "GRAPHQL") {
    const doc = validateGraphQLOperationDocument(data.graphqlOperation || "");
    if (!doc.ok) {
      ctx.addIssue({
        code: "custom",
        message: doc.error,
        path: ["graphqlOperation"],
      });
    } else {
      const risk = enforceGraphQLRiskPolicy({
        operationType: doc.operationType,
        riskLevel: data.riskLevel,
        accessClass: data.accessClass,
        requiresConfirmation: data.requiresConfirmation,
      });
      if (!risk.ok) {
        ctx.addIssue({
          code: "custom",
          message: risk.error,
          path: ["riskLevel"],
        });
      } else {
        data.riskLevel = risk.riskLevel;
        if (risk.accessClass) data.accessClass = risk.accessClass;
        if (risk.requiresConfirmation) data.requiresConfirmation = true;
        if (!data.graphqlOperationName && doc.operationName) {
          data.graphqlOperationName = doc.operationName;
        }
      }
    }
  }

  if (data.paginationJson !== undefined && data.paginationJson !== null) {
    const page = validatePaginationConfig(data.paginationJson);
    if (!page.ok) {
      ctx.addIssue({
        code: "custom",
        message: page.error,
        path: ["paginationJson"],
      });
    } else {
      data.paginationJson = page.pagination;
    }
  }
}

export const createAgentActionSchema = z
  .object({
    name: nameSchema,
    description: z.string().trim().min(1, "Description is required").max(500),
    method: methodSchema.default("GET"),
    urlTemplate: urlTemplateSchema,
    headersJson: jsonObjectSchema,
    requestContentType: requestContentTypeSchema.optional().default("application/json"),
    requestBodyTemplate: jsonObjectSchema,
    parameterBindings: jsonObjectSchema,
    inputSchemaJson: jsonObjectSchema,
    outputSchemaJson: jsonObjectSchema,
    responseProjectionJson: jsonObjectSchema,
    enabled: z.boolean().optional().default(true),
    timeoutMs: z
      .number()
      .int()
      .optional()
      .transform((v) => clampActionTimeoutMs(v ?? 8000)),
    ...redesignFields,
    ...protocolFields,
  })
  .superRefine((data, ctx) => applyActionPolicyChecks(data, ctx))
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
    connectionId: z.string().trim().min(1).nullable().optional(),
    headersJson: jsonObjectSchema,
    requestContentType: requestContentTypeSchema.optional(),
    requestBodyTemplate: jsonObjectSchema,
    parameterBindings: jsonObjectSchema,
    inputSchemaJson: jsonObjectSchema,
    outputSchemaJson: jsonObjectSchema,
    responseProjectionJson: jsonObjectSchema,
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
    protocol: protocolSchema.optional(),
    graphqlOperation: z.string().trim().max(20_000).nullable().optional(),
    graphqlOperationName: z.string().trim().max(120).nullable().optional(),
    resultInstructions: z.string().trim().max(1000).nullable().optional(),
    paginationJson: jsonObjectSchema,
  })
  .refine(
    (data) =>
      data.name !== undefined ||
      data.description !== undefined ||
      data.method !== undefined ||
      data.urlTemplate !== undefined ||
      data.connectionId !== undefined ||
      data.headersJson !== undefined ||
      data.requestContentType !== undefined ||
      data.requestBodyTemplate !== undefined ||
      data.parameterBindings !== undefined ||
      data.inputSchemaJson !== undefined ||
      data.outputSchemaJson !== undefined ||
      data.responseProjectionJson !== undefined ||
      data.enabled !== undefined ||
      data.timeoutMs !== undefined ||
      data.credentialId !== undefined ||
      data.riskLevel !== undefined ||
      data.requiresConfirmation !== undefined ||
      data.requiresIdentity !== undefined ||
      data.identityMode !== undefined ||
      data.accessClass !== undefined ||
      data.idempotent !== undefined ||
      data.protocol !== undefined ||
      data.graphqlOperation !== undefined ||
      data.graphqlOperationName !== undefined ||
      data.resultInstructions !== undefined ||
      data.paginationJson !== undefined,
    { message: "At least one field is required", path: ["form"] }
  )
  .superRefine((data, ctx) => {
    if (
      data.method !== undefined ||
      data.riskLevel !== undefined ||
      data.accessClass !== undefined ||
      data.protocol !== undefined ||
      data.graphqlOperation !== undefined ||
      data.requestBodyTemplate !== undefined ||
      data.paginationJson !== undefined
    ) {
      applyActionPolicyChecks(
        {
          method: data.method || "GET",
          riskLevel: data.riskLevel || "READ",
          accessClass: data.accessClass || "PUBLIC_READ",
          protocol: data.protocol || "REST_JSON",
          graphqlOperation: data.graphqlOperation,
          graphqlOperationName: data.graphqlOperationName,
          requiresConfirmation: data.requiresConfirmation,
          requestBodyTemplate: data.requestBodyTemplate,
          urlTemplate: data.urlTemplate || "https://example.com/",
          paginationJson: data.paginationJson,
        },
        ctx
      );
    }
  })
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
