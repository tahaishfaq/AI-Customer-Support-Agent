/** Default webchat customization (AIDE orange brand). */

export const DEFAULT_CUSTOMIZATION = {
  identity: {
    avatarUrl: null,
    displayName: "",
    description: "",
    messagePlaceholder: "Type your message...",
    footer: "by AIDE",
    contactEmail: "",
    contactPhone: "",
    contactWebsite: "",
    termsUrl: "",
    privacyUrl: "",
    /** White-label (paid): company logo in the widget header. */
    logoUrl: null,
    /** Up to 3 extra team avatar image URLs stacked beside the agent avatar. */
    teamAvatars: [],
    greetingTitle: "Hi there 👋",
    greetingSubtitle: "How can we help?",
    conversationIntro: "Ask us anything, or share your feedback.",
  },
  appearance: {
    primaryColor: "#ea580c",
    font: "dm-sans",
    theme: "light",
    headerStyle: "primary",
    messageStyle: "darker",
    cornerRadius: 16,
    customCss: "",
  },
  deploy: {
    chatInterface: "toggle",
    chatLauncher: "bubble",
    buttonImageUrl: null,
    useBotAvatar: true,
    proactiveEnabled: false,
    proactiveMessage: "Hi! Need help?",
    widgetPosition: "bottom-right",
    /** Visitors may expand the chat panel to a larger window. */
    allowExpand: true,
  },
  features: {
    messageFeedback: false,
    fileUpload: false,
    notificationSound: false,
    conversationHistory: true,
    historyReset: "1d",
    rateLimitingEnabled: false,
    rateLimitRequests: 25,
    rateLimitMinutes: 1,
    ipBlocklist: "",
    allowedOriginsMode: "all",
    allowedOrigins: "",
  },
  /** Messenger Home tab content. */
  home: {
    /** [{ label, url }] — up to 5 https links shown as cards. */
    links: [],
    status: {
      enabled: false,
      level: "operational",
      message: "",
      url: "",
    },
  },
  branding: {
    /** White-label (paid): remove the "by AIDE" footer entirely. */
    hideAideBranding: false,
  },
};

/** Nested objects merged one level deeper than their section. */
const NESTED_KEYS = { home: ["status"] };

function isPlainObject(value) {
  return value != null && typeof value === "object" && !Array.isArray(value);
}

/** Shallow-merge each top-level section onto defaults. */
export function mergeCustomization(stored) {
  const source = isPlainObject(stored) ? stored : {};
  const result = {};

  for (const key of Object.keys(DEFAULT_CUSTOMIZATION)) {
    const base = DEFAULT_CUSTOMIZATION[key];
    const patch = isPlainObject(source[key]) ? source[key] : {};
    const merged = { ...base, ...patch };
    for (const nested of NESTED_KEYS[key] || []) {
      merged[nested] = {
        ...base[nested],
        ...(isPlainObject(patch[nested]) ? patch[nested] : {}),
      };
    }
    result[key] = merged;
  }

  return result;
}

/** Merge a partial PATCH onto stored customization (section-aware). */
export function applyCustomizationPatch(stored, patch) {
  const current = mergeCustomization(stored);
  if (!isPlainObject(patch)) return current;

  const home = { ...current.home, ...(patch.home || {}) };
  if (isPlainObject(patch.home?.status)) {
    home.status = { ...current.home.status, ...patch.home.status };
  }
  return mergeCustomization({
    identity: { ...current.identity, ...(patch.identity || {}) },
    appearance: { ...current.appearance, ...(patch.appearance || {}) },
    deploy: { ...current.deploy, ...(patch.deploy || {}) },
    features: { ...current.features, ...(patch.features || {}) },
    home,
    branding: { ...current.branding, ...(patch.branding || {}) },
  });
}

/** True after the user has saved widget settings that differ from stock defaults. */
export function isCustomizationTouched(stored) {
  if (!isPlainObject(stored) || Object.keys(stored).length === 0) {
    return false;
  }
  return (
    JSON.stringify(mergeCustomization(stored)) !==
    JSON.stringify(DEFAULT_CUSTOMIZATION)
  );
}
export function resolveCustomization(agent) {
  const merged = mergeCustomization(agent?.customization);
  if (!merged.identity.displayName?.trim() && agent?.name) {
    merged.identity.displayName = agent.name;
  }
  if (!merged.identity.description?.trim() && agent?.description) {
    merged.identity.description = agent.description;
  }
  return merged;
}
