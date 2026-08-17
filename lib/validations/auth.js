import { z } from "zod";

export const registerSchema = z
  .object({
    name: z.string().trim().min(1, "Name is required"),
    email: z.string().trim().email("Valid email is required"),
    password: z.string().min(8, "Password must be at least 8 characters"),
    confirmPassword: z.string().min(1, "Confirm password is required"),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Passwords must match",
    path: ["confirmPassword"],
  });

export const loginSchema = z.object({
  email: z.string().trim().email("Valid email is required"),
  password: z.string().min(1, "Password is required"),
});

export const googleSchema = z.object({
  idToken: z.string().min(1, "Google ID token is required"),
});

export function zodErrorDetails(error) {
  const details = {};
  for (const issue of error.issues) {
    const key = issue.path.join(".") || "form";
    details[key] = issue.message;
  }
  return details;
}
