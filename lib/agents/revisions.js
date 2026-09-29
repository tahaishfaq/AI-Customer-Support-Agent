/**
 * Level 2 · P5 — agent versioning. Pure: what a version holds, how versions are compared, and the
 * patch a restore sends through the normal agent save (so every save check still applies).
 */

import { createHash } from "node:crypto";
import { mergeCustomization } from "../customization/defaults.js";

/** Fields a version captures: how the agent behaves and looks. Tools, crawl and keys are not versioned. */
export const REVISION_FIELDS = Object.freeze([
  "name",
  "description",
  "systemPrompt",
  "answerStyle",
  "welcomeMessage",
  "guidance",
  "webSearchEnabled",
  "customization",
]);

/** History kept per agent; the oldest versions are pruned beyond this. */
export const MAX_REVISIONS = 100;

/** Agent row → snapshot. Missing values are normalized so equal agents hash equally. */
export function snapshotFromAgent(agent) {
  const a = agent || {};
  return {
    name: String(a.name || ""),
    description: a.description == null ? "" : String(a.description),
    systemPrompt: String(a.systemPrompt || ""),
    answerStyle: a.answerStyle || null,
    welcomeMessage: a.welcomeMessage == null ? "" : String(a.welcomeMessage),
    guidance: Array.isArray(a.guidance) ? a.guidance : [],
    webSearchEnabled: Boolean(a.webSearchEnabled),
    customization: mergeCustomization(a.customization),
  };
}

/**
 * JSON with sorted keys, so key order never changes the hash. "" and null are the same value: the
 * save validation turns some empty strings into null (e.g. home.status.url), and a restored
 * version must still match the one it came from.
 */
export function stableStringify(value) {
  if (value === "") return "null";
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(",")}]`;
  if (value && typeof value === "object") {
    return `{${Object.keys(value)
      .sort()
      .filter((key) => value[key] !== undefined)
      .map((key) => `${JSON.stringify(key)}:${stableStringify(value[key])}`)
      .join(",")}}`;
  }
  return JSON.stringify(value ?? null);
}

export function hashSnapshot(snapshot) {
  return createHash("sha256").update(stableStringify(snapshot)).digest("hex");
}

/** Snapshot fields that differ (for the history list: "Prompt, Guidance changed"). */
export function changedFields(before, after) {
  if (!before) return [];
  return REVISION_FIELDS.filter((field) => stableStringify(before[field]) !== stableStringify(after?.[field]));
}

/** True when an agent save touches something a version captures. */
export function patchTouchesRevision(data) {
  return REVISION_FIELDS.some((field) => data?.[field] !== undefined);
}

/**
 * Snapshot → body for the normal agent save (validated like a PUT). Guidance [] clears the rules;
 * the whole customization is sent so the restored widget matches the version exactly.
 */
export function snapshotToPatch(snapshot) {
  const s = snapshot || {};
  const patch = {
    name: s.name,
    // "" clears the description (the update schema maps it to null).
    description: typeof s.description === "string" ? s.description : "",
    systemPrompt: s.systemPrompt,
    welcomeMessage: s.welcomeMessage,
    guidance: Array.isArray(s.guidance) ? s.guidance : [],
    webSearchEnabled: Boolean(s.webSearchEnabled),
    customization: s.customization,
  };
  if (s.answerStyle) patch.answerStyle = s.answerStyle;
  // Required text fields are only sent when present (an old version never clears them).
  for (const key of ["name", "systemPrompt", "welcomeMessage"]) {
    if (!patch[key]) delete patch[key];
  }
  if (!patch.customization) delete patch.customization;
  return patch;
}

/** Friendly labels for the UI. */
export const REVISION_FIELD_LABELS = Object.freeze({
  name: "Name",
  description: "Description",
  systemPrompt: "Prompt",
  answerStyle: "Answer style",
  welcomeMessage: "Welcome message",
  guidance: "Guidance",
  webSearchEnabled: "Web search",
  customization: "Widget",
});
