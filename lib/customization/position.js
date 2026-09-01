/** Widget layout on the customer site (toggle bubble corners + full page). */

export const DEFAULT_WIDGET_POSITION = "bottom-right";

export const WIDGET_LAYOUT_OPTIONS = [
  { id: "bottom-right", label: "Right bottom" },
  { id: "bottom-left", label: "Left bottom" },
  { id: "full-page", label: "Full screen" },
];

/** Corner anchors used by embed.js (bubble mode only). */
export const WIDGET_POSITIONS = [
  {
    id: "bottom-left",
    label: "Left bottom",
    horizontal: "left",
    vertical: "bottom",
  },
  {
    id: "bottom-right",
    label: "Right bottom",
    horizontal: "right",
    vertical: "bottom",
  },
];

const POSITION_MAP = Object.fromEntries(
  WIDGET_POSITIONS.map((item) => [item.id, item])
);

const LAYOUT_IDS = new Set(WIDGET_LAYOUT_OPTIONS.map((item) => item.id));

export function normalizeWidgetPosition(value) {
  const id = typeof value === "string" ? value.trim() : "";
  if (id === "bottom-left") return "bottom-left";
  if (POSITION_MAP[id]) {
    return id.includes("left") ? "bottom-left" : "bottom-right";
  }
  return DEFAULT_WIDGET_POSITION;
}

export function resolveWidgetLayout(deploy = {}) {
  if (deploy.chatInterface === "embedded") return "full-page";
  return normalizeWidgetPosition(deploy.widgetPosition);
}

export function applyWidgetLayout(deploy = {}, layoutId) {
  if (layoutId === "full-page") {
    return { ...deploy, chatInterface: "embedded" };
  }
  return {
    ...deploy,
    chatInterface: "toggle",
    widgetPosition:
      layoutId === "bottom-left" ? "bottom-left" : "bottom-right",
  };
}

export function parseWidgetPosition(value) {
  const id = normalizeWidgetPosition(value);
  return POSITION_MAP[id] || POSITION_MAP[DEFAULT_WIDGET_POSITION];
}

export function positionToChatAlign(value) {
  const pos = parseWidgetPosition(value);
  return pos.horizontal === "left" ? "start" : "end";
}

export function positionToFlexAlign(value) {
  const pos = parseWidgetPosition(value);
  return {
    alignItems: "flex-end",
    justifyContent: pos.horizontal === "left" ? "flex-start" : "flex-end",
  };
}

/** Tailwind classes for preview mockups (absolute positioning). */
export function positionToPreviewClasses(value) {
  const pos = parseWidgetPosition(value);
  const horizontal = pos.horizontal === "left" ? "left-6" : "right-6";
  const items = pos.horizontal === "left" ? "items-start" : "items-end";
  return {
    container: `absolute z-10 bottom-6 ${horizontal}`,
    items,
  };
}

export function isWidgetLayoutId(value) {
  return LAYOUT_IDS.has(value);
}
