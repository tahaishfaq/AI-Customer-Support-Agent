import { z } from "zod";

/** Hard store caps — keep below retrieval packing pressure. */
export const TEXT_KNOWLEDGE_NAME_MAX = 200;
export const TEXT_KNOWLEDGE_CONTENT_MAX = 100_000;
export const CRAWL_PAGE_KNOWLEDGE_PREFIX = "Website page | ";

export const createTextKnowledgeSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, "Name is required")
    .max(TEXT_KNOWLEDGE_NAME_MAX, `Name must be ${TEXT_KNOWLEDGE_NAME_MAX} characters or fewer`),
  type: z.literal("TEXT").optional(),
  content: z
    .string()
    .trim()
    .min(1, "Content is required")
    .max(
      TEXT_KNOWLEDGE_CONTENT_MAX,
      `Content must be ${TEXT_KNOWLEDGE_CONTENT_MAX} characters or fewer`
    ),
});

export const updateTextKnowledgeSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, "Name is required")
    .max(TEXT_KNOWLEDGE_NAME_MAX, `Name must be ${TEXT_KNOWLEDGE_NAME_MAX} characters or fewer`)
    .optional(),
  content: z
    .string()
    .trim()
    .min(1, "Content is required")
    .max(
      TEXT_KNOWLEDGE_CONTENT_MAX,
      `Content must be ${TEXT_KNOWLEDGE_CONTENT_MAX} characters or fewer`
    )
    .optional(),
}).refine((data) => data.name !== undefined || data.content !== undefined, {
  message: "Provide name and/or content to update",
});

export { zodErrorDetails } from "@/lib/validations/auth";
