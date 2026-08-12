import { z } from "zod";

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
  welcomeMessage: z.string().trim().min(1, "Welcome message is required"),
});

export const updateAgentSchema = z
  .object({
    name: z.string().trim().min(1, "Name is required").optional(),
    description: optionalDescription,
    systemPrompt: z.string().trim().min(1, "System prompt is required").optional(),
    welcomeMessage: z
      .string()
      .trim()
      .min(1, "Welcome message is required")
      .optional(),
  })
  .refine(
    (data) =>
      data.name !== undefined ||
      data.description !== undefined ||
      data.systemPrompt !== undefined ||
      data.welcomeMessage !== undefined,
    {
      message: "At least one field is required",
      path: ["form"],
    }
  );

export { zodErrorDetails } from "@/lib/validations/auth";
