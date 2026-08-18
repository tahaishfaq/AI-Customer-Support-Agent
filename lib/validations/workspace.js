import { z } from "zod";

export const workspaceNameSchema = z
  .string()
  .trim()
  .min(1, "Name is required")
  .max(60, "Name must be 60 characters or fewer");

export const createWorkspaceSchema = z.object({
  name: workspaceNameSchema,
});

export const updateWorkspaceSchema = z.object({
  name: workspaceNameSchema,
});

export const deleteWorkspaceSchema = z.object({
  confirm: z.boolean().optional(),
});

export { zodErrorDetails } from "@/lib/validations/auth";
