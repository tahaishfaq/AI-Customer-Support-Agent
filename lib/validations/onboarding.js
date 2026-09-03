import { z } from "zod";

export const onboardingInterestSchema = z.object({
  firstName: z.string().trim().min(1, "First name required").max(80),
  lastName: z.string().trim().min(1, "Last name required").max(80),
  phone: z
    .string()
    .trim()
    .min(10, "Enter a valid phone number")
    .max(20)
    .regex(/^\+?[0-9\s-]{10,20}$/, "Use international format, e.g. +92 300 1234567"),
  country: z
    .string()
    .trim()
    .length(2, "Use a 2-letter country code")
    .transform((value) => value.toUpperCase()),
  websiteUrl: z
    .string()
    .trim()
    .max(500)
    .optional()
    .transform((value) => String(value || "").trim())
    .refine(
      (value) => !value || /^https?:\/\//i.test(value),
      "Enter a valid https website URL (or leave blank)"
    ),
  companyType: z.enum([
    "E-commerce",
    "SaaS",
    "Agency",
    "Services",
    "Other",
  ]),
  teamSize: z.enum([
    "Just me",
    "2–5 people",
    "6–20 people",
    "21+ people",
  ]),
  monthlyConversations: z.enum([
    "Under 100 / month",
    "100–500 / month",
    "500–2,000 / month",
    "2,000+ / month",
  ]),
  primaryGoal: z.enum([
    "Deflect support tickets",
    "24/7 FAQ on my site",
    "AI + human handoff",
    "Capture sales leads",
    "Connect orders / APIs",
  ]),
});

/** @deprecated use onboardingInterestSchema */
export const onboardingSchema = onboardingInterestSchema;

export { zodErrorDetails } from "@/lib/validations/auth";
