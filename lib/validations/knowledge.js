import { z } from "zod";

export const createTextKnowledgeSchema = z.object({
  name: z.string().trim().min(1, "Name is required"),
  type: z.literal("TEXT").optional(),
  content: z.string().trim().min(1, "Content is required"),
});

export { zodErrorDetails } from "@/lib/validations/auth";
