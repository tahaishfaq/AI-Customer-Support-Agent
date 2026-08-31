import { z } from "zod";
import { customizationSchema } from "@/lib/validations/customization";

const answerStyleSchema = z.enum(["SHORT", "DETAILED", "HYBRID"]);
const crawlRecrawlHoursSchema = z.union([
  z.literal(0),
  z.literal(24),
  z.literal(72),
  z.literal(168),
  z.literal(720),
]);

const optionalDescription = z
  .string()
  .trim()
  .optional()
  .transform((value) => {
    if (value === undefined) return undefined;
    if (value === "") return null;
    return value;
  });

export const createAgentSchema = z.object({
  name: z.string().trim().min(1, "Name is required"),
  description: optionalDescription,
  systemPrompt: z.string().trim().min(1, "System prompt is required"),
  answerStyle: answerStyleSchema.optional().default("DETAILED"),
  welcomeMessage: z.string().trim().min(1, "Welcome message is required"),
});

export const updateAgentSchema = z
  .object({
    name: z.string().trim().min(1, "Name is required").optional(),
    description: optionalDescription,
    systemPrompt: z.string().trim().min(1, "System prompt is required").optional(),
    answerStyle: answerStyleSchema.optional(),
    welcomeMessage: z
      .string()
      .trim()
      .min(1, "Welcome message is required")
      .optional(),
    customization: customizationSchema.optional(),
    crawlRecrawlHours: crawlRecrawlHoursSchema.optional(),
    actionsEnabled: z.boolean().optional(),
    webSearchEnabled: z.boolean().optional(),
  })
  .refine(
    (data) =>
      data.name !== undefined ||
      data.description !== undefined ||
      data.systemPrompt !== undefined ||
      data.answerStyle !== undefined ||
      data.welcomeMessage !== undefined ||
      data.customization !== undefined ||
      data.crawlRecrawlHours !== undefined ||
      data.actionsEnabled !== undefined ||
      data.webSearchEnabled !== undefined,
    {
      message: "At least one field is required",
      path: ["form"],
    }
  );

export { zodErrorDetails } from "@/lib/validations/auth";
export { customizationSchema } from "@/lib/validations/customization";
