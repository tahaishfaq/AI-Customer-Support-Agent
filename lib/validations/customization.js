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

/** https URL or empty (→ null). Widget images and links never load over http. */
const httpsUrlOrNull = z
  .string()
  .trim()
  .max(2048)
  .nullable()
  .optional()
  .transform((value) => (value === undefined ? undefined : value ? value : null))
  .refine((value) => value == null || /^https:\/\/[^\s]+$/i.test(value), "Use an https:// URL");

const shortText = (max) => z.string().trim().max(max).optional();

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
    logoUrl: httpsUrlOrNull,
    teamAvatars: z
      .array(z.string().trim().max(2048).regex(/^https:\/\/[^\s]+$/i, "Use an https:// URL"))
      .max(3)
      .optional(),
    greetingTitle: shortText(60),
    greetingSubtitle: shortText(80),
    conversationIntro: shortText(160),
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
    allowExpand: z.boolean().optional(),
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

export const homeCustomizationSchema = z
  .object({
    links: z
      .array(
        z
          .object({
            label: z.string().trim().min(1).max(40),
            url: z.string().trim().max(2048).regex(/^https:\/\/[^\s]+$/i, "Use an https:// URL"),
          })
          .strip()
      )
      .max(5)
      .optional(),
    status: z
      .object({
        enabled: z.boolean().optional(),
        level: z.enum(["operational", "degraded", "maintenance"]).optional(),
        message: shortText(120),
        url: httpsUrlOrNull,
      })
      .strip()
      .optional(),
  })
  .strip();

export const brandingCustomizationSchema = z
  .object({
    hideAideBranding: z.boolean().optional(),
  })
  .strip();

export const customizationSchema = z
  .object({
    identity: identityCustomizationSchema.optional(),
    appearance: appearanceCustomizationSchema.optional(),
    deploy: deployCustomizationSchema.optional(),
    features: featuresCustomizationSchema.optional(),
    home: homeCustomizationSchema.optional(),
    branding: brandingCustomizationSchema.optional(),
  })
  .strip();
