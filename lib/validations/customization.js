import { z } from "zod";
import { WIDGET_POSITIONS } from "@/lib/customization/position";

const widgetPositionIds = WIDGET_POSITIONS.map((item) => item.id);

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
  .strip();

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
  .strip();

export const deployCustomizationSchema = z
  .object({
    chatInterface: z.enum(["toggle", "embedded"]).optional(),
    chatLauncher: z.enum(["bubble", "custom"]).optional(),
    buttonImageUrl: emptyToNull,
    useBotAvatar: z.boolean().optional(),
    proactiveEnabled: z.boolean().optional(),
    proactiveMessage: optionalTrimmed,
    widgetPosition: z.enum(widgetPositionIds).optional(),
  })
  .strip();

export const featuresCustomizationSchema = z
  .object({
    messageFeedback: z.boolean().optional(),
    fileUpload: z.boolean().optional(),
    notificationSound: z.boolean().optional(),
    conversationHistory: z.boolean().optional(),
    historyReset: z.enum(["never", "session", "1d", "7d"]).optional(),
    rateLimitingEnabled: z.boolean().optional(),
    rateLimitRequests: z.number().int().min(1).max(10000).optional(),
    rateLimitMinutes: z.number().int().min(1).max(1440).optional(),
    ipBlocklist: optionalTrimmed,
    allowedOriginsMode: z.enum(["all", "allowlist"]).optional(),
    allowedOrigins: optionalTrimmed,
  })
  .strip();

export const customizationSchema = z
  .object({
    identity: identityCustomizationSchema.optional(),
    appearance: appearanceCustomizationSchema.optional(),
    deploy: deployCustomizationSchema.optional(),
    features: featuresCustomizationSchema.optional(),
  })
  .strip();
