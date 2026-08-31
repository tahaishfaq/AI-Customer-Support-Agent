import { z } from "zod";

export function zodErrorDetails(error) {
  const details = {};
  for (const issue of error.issues) {
    const key = issue.path.join(".") || "form";
    details[key] = issue.message;
  }
  return details;
}

const authTypeSchema = z
  .string()
  .transform((v) => String(v || "NONE").toUpperCase())
  .refine((v) => ["NONE", "BEARER", "HEADER"].includes(v), {
    message: "authType must be NONE, BEARER, or HEADER",
  });

const transportSchema = z
  .string()
  .transform((v) => String(v || "HTTP").toUpperCase())
  .refine((v) => ["HTTP", "SSE"].includes(v), {
    message: "transport must be HTTP or SSE",
  });

export const createMcpServerSchema = z.object({
  name: z.string().trim().min(2).max(64),
  url: z.string().trim().url().max(2048),
  transport: transportSchema.optional().default("HTTP"),
  authType: authTypeSchema.optional().default("NONE"),
  headerName: z.string().trim().max(64).nullable().optional(),
  credentialId: z.string().trim().min(1).nullable().optional(),
  enabled: z.boolean().optional().default(true),
});

export const updateMcpServerSchema = z.object({
  name: z.string().trim().min(2).max(64).optional(),
  url: z.string().trim().url().max(2048).optional(),
  transport: transportSchema.optional(),
  authType: authTypeSchema.optional(),
  headerName: z.string().trim().max(64).nullable().optional(),
  credentialId: z.string().trim().min(1).nullable().optional(),
  enabled: z.boolean().optional(),
});

export const updateMcpToolSchema = z.object({
  enabled: z.boolean().optional(),
  riskLevel: z
    .string()
    .transform((v) => String(v || "").toUpperCase())
    .refine((v) => ["READ", "WRITE", "DESTRUCTIVE"].includes(v), {
      message: "riskLevel must be READ, WRITE, or DESTRUCTIVE",
    })
    .optional(),
  requiresConfirmation: z.boolean().optional(),
});
