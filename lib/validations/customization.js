import { z } from "zod";

const emptyToNull = z
  .string()
  .trim()
  .nullable()
  .optional()
  .transform((value) => {
    if (value === undefined) return undefined;
    if (value === null || value === "") return null;
    return value;
  });

const optionalTrimmed = z
  .string()
  .trim()
  .optional()
  .transform((value) => (value === undefined ? undefined : value));

export const identityCustomizationSchema = z
  .object({
    avatarUrl: emptyToNull,
    displayName: optionalTrimmed,
    description: optionalTrimmed,
    messagePlaceholder: optionalTrimmed,
    footer: optionalTrimmed,
    contactEmail: optionalTrimmed,
    contactPhone: optionalTrimmed,
    contactWebsite: optionalTrimmed,
    termsUrl: optionalTrimmed,
    privacyUrl: optionalTrimmed,
  })
  .strict();

export const appearanceCustomizationSchema = z
  .object({
    primaryColor: z
      .string()
      .trim()
      .regex(/^#([0-9A-Fa-f]{6})$/, "Use a hex color like #0b5f58")
      .optional(),
    font: z.enum(["instrument-sans", "dm-sans", "system"]).optional(),
    theme: z.enum(["light", "dark"]).optional(),
    headerStyle: z.enum(["solid", "primary"]).optional(),
    messageStyle: z.enum(["light", "darker"]).optional(),
    cornerRadius: z.number().int().min(0).max(28).optional(),
    customCss: z.string().max(20000).optional(),
  })
  .strict();

export const deployCustomizationSchema = z
  .object({
    chatInterface: z.enum(["toggle", "embedded"]).optional(),
    chatLauncher: z.enum(["bubble", "custom"]).optional(),
    buttonImageUrl: emptyToNull,
    useBotAvatar: z.boolean().optional(),
    proactiveEnabled: z.boolean().optional(),
    proactiveMessage: optionalTrimmed,
  })
  .strict();

export const featuresCustomizationSchema = z
  .object({
    messageFeedback: z.boolean().optional(),
    fileUpload: z.boolean().optional(),
    notificationSound: z.boolean().optional(),
    conversationHistory: z.boolean().optional(),
    historyReset: z.enum(["never", "session", "1d", "7d"]).optional(),
  })
  .strict();

export const customizationSchema = z
  .object({
    identity: identityCustomizationSchema.optional(),
    appearance: appearanceCustomizationSchema.optional(),
    deploy: deployCustomizationSchema.optional(),
    features: featuresCustomizationSchema.optional(),
  })
  .strict();
