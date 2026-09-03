import { z } from "zod";

const planTypeEnum = z.enum(["FREE", "POPULAR", "TEAMS", "CUSTOM"]);
const intervalEnum = z.enum(["MONTH", "YEAR"]);
const requestStatusEnum = z.enum([
  "NEW",
  "CONTACTED",
  "APPROVED",
  "REJECTED",
  "CONVERTED",
]);

export const updateBillingPlanSchema = z.object({
  name: z.string().trim().min(1).max(80).optional(),
  description: z.string().trim().max(500).nullable().optional(),
  isPopular: z.boolean().optional(),
  priceMinor: z.number().int().min(0).max(99_999_999).optional(),
  currency: z.string().trim().min(3).max(8).optional(),
  interval: intervalEnum.optional(),
  safepayPlanId: z.string().trim().max(120).nullable().optional(),
  maxWorkspaces: z.number().int().min(0).max(9999).optional(),
  maxAgentsPerWorkspace: z.number().int().min(0).max(9999).optional(),
  maxConversationsPerMonth: z.number().int().min(0).max(9_999_999).optional(),
  featuresJson: z.array(z.string().trim().min(1).max(200)).max(20).optional(),
  isActive: z.boolean().optional(),
  isDefault: z.boolean().optional(),
});

export const customPlanRequestSchema = z.object({
  planId: z.string().trim().min(1).optional(),
  companyName: z.string().trim().max(120).optional(),
  contactName: z.string().trim().max(120).optional(),
  contactEmail: z.string().trim().email().optional(),
  phone: z.string().trim().max(40).optional(),
  estimatedSeats: z.number().int().min(1).max(10_000).optional(),
  useCase: z.string().trim().max(120).optional(),
  message: z
    .string()
    .trim()
    .min(10, "Tell us a bit more about what you need")
    .max(4000),
});

export const subscribeFreeSchema = z.object({
  planId: z.string().trim().min(1, "Plan is required"),
});

export const checkoutPaidSchema = z.object({
  planId: z.string().trim().min(1, "Plan is required"),
});

export const updateCustomPlanRequestSchema = z.object({
  status: requestStatusEnum.optional(),
  adminNotes: z.string().trim().max(4000).nullable().optional(),
});

export { planTypeEnum, intervalEnum, requestStatusEnum };
export { zodErrorDetails } from "@/lib/validations/auth";
