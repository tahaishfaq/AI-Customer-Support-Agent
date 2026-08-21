/** Default webchat customization (Hapy teal). */

export const DEFAULT_CUSTOMIZATION = {
  identity: {
    avatarUrl: null,
    displayName: "",
    description: "",
    messagePlaceholder: "Type your message...",
    footer: "by Hapy",
    contactEmail: "",
    contactPhone: "",
    contactWebsite: "",
    termsUrl: "",
    privacyUrl: "",
  },
  appearance: {
    primaryColor: "#0b5f58",
    font: "instrument-sans",
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
  },
  features: {
    messageFeedback: false,
    fileUpload: false,
    notificationSound: false,
    conversationHistory: true,
    historyReset: "never",
    rateLimitingEnabled: false,
    rateLimitRequests: 25,
    rateLimitMinutes: 1,
    ipBlocklist: "",
    allowedOriginsMode: "all",
    allowedOrigins: "",
  },
};

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
    result[key] = { ...base, ...patch };
  }

  return result;
}

/** Merge a partial PATCH onto stored customization (section-aware). */
export function applyCustomizationPatch(stored, patch) {
  const current = mergeCustomization(stored);
  if (!isPlainObject(patch)) return current;

  return mergeCustomization({
    identity: { ...current.identity, ...(patch.identity || {}) },
    appearance: { ...current.appearance, ...(patch.appearance || {}) },
    deploy: { ...current.deploy, ...(patch.deploy || {}) },
    features: { ...current.features, ...(patch.features || {}) },
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
