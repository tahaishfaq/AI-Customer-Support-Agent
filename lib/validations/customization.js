import { z } from "zod";
import { WIDGET_POSITIONS } from "@/lib/customization/position";
import { SUPPORT_DAYS, TIME_PATTERN, isValidTimeZone } from "@/lib/desk/support-hours";

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
    agentBubbleColor: z
      .string()
      .trim()
      .regex(/^#([0-9A-Fa-f]{6})$/, "Use a hex color like #0b5f58")
      .nullable()
      .optional(),
    userBubbleColor: z
      .string()
      .trim()
      .regex(/^#([0-9A-Fa-f]{6})$/, "Use a hex color like #0b5f58")
      .nullable()
      .optional(),
    font: z.enum(["instrument-sans", "dm-sans", "system"]).optional(),
    theme: z.enum(["light", "dark"]).optional(),
    headerStyle: z.enum(["solid", "primary"]).optional(),
    messageStyle: z.enum(["light", "darker"]).optional(),
    cornerRadius: z.number().int().min(0).max(28).optional(),
    customCss: z.string().max(20000).optional(),
  })
  .strip();

/** Level 2 · P6 — one targeted proactive message. */
export const proactiveRuleSchema = z
  .object({
    id: z.string().regex(/^[a-zA-Z0-9_-]{1,40}$/, "Invalid rule id"),
    enabled: z.boolean().default(true),
    message: z.string().trim().min(1, "Message is required").max(200, "Keep the message under 200 characters"),
    match: z.enum(["any", "contains", "prefix"]).default("any"),
    path: z.string().trim().max(200).default(""),
    delaySeconds: z.number().int().min(0).max(600).default(0),
    audience: z.enum(["all", "identified", "anonymous"]).default("all"),
    frequency: z.enum(["every_page", "once_per_session", "once_per_visitor"]).default("every_page"),
  })
  .strip()
  .refine((rule) => rule.match === "any" || rule.path.length > 0, {
    message: "Add the page path to match, or choose “Every page”",
    path: ["path"],
  });

export const proactiveRulesSchema = z
  .array(proactiveRuleSchema)
  .max(10, "Up to 10 proactive messages")
  .refine((rules) => new Set(rules.map((rule) => rule.id)).size === rules.length, { message: "Duplicate rule id" });

export const deployCustomizationSchema = z
  .object({
    chatInterface: z.enum(["toggle", "embedded"]).optional(),
    chatLauncher: z.enum(["bubble", "custom"]).optional(),
    buttonImageUrl: emptyToNull,
    useBotAvatar: z.boolean().optional(),
    proactiveEnabled: z.boolean().optional(),
    proactiveMessage: optionalTrimmed,
    proactiveRules: proactiveRulesSchema.optional(),
    widgetPosition: z.enum(widgetPositionIds).optional(),
    allowExpand: z.boolean().optional(),
    launcherShape: z.enum(["pill", "circle", "square"]).optional(),
    launcherSize: z.enum(["sm", "md", "lg"]).optional(),
    launcherBorder: z.enum(["gradient", "solid", "none"]).optional(),
    launcherBorderColor: z
      .string()
      .trim()
      .regex(/^#([0-9A-Fa-f]{6})$/, "Use a hex color like #ea580c")
      .nullable()
      .optional(),
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

export const supportCustomizationSchema = z
  .object({
    hoursEnabled: z.boolean().optional(),
    timezone: z
      .string()
      .trim()
      .max(64)
      .refine(isValidTimeZone, "Use an IANA timezone such as Asia/Karachi")
      .optional(),
    weekly: z
      .array(
        z
          .object({
            day: z.enum(SUPPORT_DAYS),
            open: z.string().regex(TIME_PATTERN, "Use HH:MM (24h)"),
            close: z.string().regex(TIME_PATTERN, "Use HH:MM (24h)"),
          })
          .strip()
      )
      .max(14)
      .optional(),
    offlineMessage: shortText(400),
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
    support: supportCustomizationSchema.optional(),
  })
  .strip();
