/**
 * Messenger widget customization: defaults/merge, validation, white-label gate + strip.
 * Run: node --import ./scripts/register-aliases.mjs --test scripts/test-embed-customization.mjs
 */
import assert from "node:assert/strict";
import { test } from "node:test";
import { applyCustomizationPatch, mergeCustomization } from "@/lib/customization/defaults";
import { customizationSchema } from "@/lib/validations/customization";
import {
  isWhiteLabelPlan,
  stripWhiteLabel,
  whiteLabelFieldsInPatch,
} from "@/lib/customization/white-label";

test("stored agents without the new sections get messenger defaults", () => {
  const merged = mergeCustomization({ appearance: { primaryColor: "#123456" } });
  assert.equal(merged.appearance.primaryColor, "#123456");
  assert.equal(merged.identity.greetingTitle, "Hi there 👋");
  assert.deepEqual(merged.home.links, []);
  assert.equal(merged.home.status.level, "operational");
  assert.equal(merged.deploy.allowExpand, true);
  assert.equal(merged.branding.hideAideBranding, false);
});

test("partial status patch keeps the other status fields", () => {
  const stored = applyCustomizationPatch({}, { home: { status: { enabled: true, message: "All good" } } });
  const next = applyCustomizationPatch(stored, { home: { status: { level: "degraded" } } });
  assert.deepEqual(next.home.status, { enabled: true, level: "degraded", message: "All good", url: "" });
});

test("validation: https only, caps on links and avatars", () => {
  assert.equal(customizationSchema.safeParse({ home: { links: [{ label: "Help", url: "http://x.com" }] } }).success, false);
  assert.equal(customizationSchema.safeParse({ home: { links: [{ label: "Help", url: "https://x.com/help" }] } }).success, true);
  assert.equal(customizationSchema.safeParse({ identity: { logoUrl: "javascript:alert(1)" } }).success, false);
  assert.equal(customizationSchema.safeParse({ identity: { teamAvatars: Array(4).fill("https://a.com/x.png") } }).success, false);
  const six = Array.from({ length: 6 }, (_, i) => ({ label: `L${i}`, url: "https://x.com" }));
  assert.equal(customizationSchema.safeParse({ home: { links: six } }).success, false);
  const cleared = customizationSchema.parse({ identity: { logoUrl: "" } });
  assert.equal(cleared.identity.logoUrl, null);
});

test("white-label fields are detected; defaults are not", () => {
  assert.deepEqual(whiteLabelFieldsInPatch({ identity: { footer: "by AIDE", greetingTitle: "Hey" } }), []);
  assert.deepEqual(
    whiteLabelFieldsInPatch({
      identity: { logoUrl: "https://a.com/l.png", footer: "Acme support" },
      deploy: { chatLauncher: "custom", buttonImageUrl: "https://a.com/b.png" },
      branding: { hideAideBranding: true },
    }),
    ["identity.logoUrl", "identity.footer", "deploy.buttonImageUrl", "branding.hideAideBranding"]
  );
});

test("unchanged stored white-label values pass (full-draft saves)", () => {
  const stored = { identity: { footer: "Acme" }, deploy: { buttonImageUrl: "https://a.com/b.png" } };
  assert.deepEqual(whiteLabelFieldsInPatch({ identity: { footer: "Acme" }, deploy: { buttonImageUrl: "https://a.com/b.png" } }, stored), []);
  assert.deepEqual(whiteLabelFieldsInPatch({ identity: { footer: "Acme 2" } }, stored), ["identity.footer"]);
  assert.deepEqual(whiteLabelFieldsInPatch({ identity: { footer: "by AIDE" } }, stored), []);
});

test("strip reverts paid branding but keeps colors, texts, links and status", () => {
  const stored = applyCustomizationPatch({}, {
    identity: { logoUrl: "https://a.com/l.png", footer: "Acme", greetingTitle: "Welcome" },
    appearance: { primaryColor: "#112233" },
    deploy: { chatLauncher: "custom", buttonImageUrl: "https://a.com/b.png" },
    home: { links: [{ label: "Help", url: "https://a.com" }] },
    branding: { hideAideBranding: true },
  });
  const stripped = stripWhiteLabel(stored);
  assert.equal(stripped.identity.logoUrl, null);
  assert.equal(stripped.identity.footer, "by AIDE");
  assert.equal(stripped.deploy.buttonImageUrl, null);
  assert.equal(stripped.deploy.useBotAvatar, true);
  assert.equal(stripped.deploy.chatLauncher, "custom", "custom element launcher is not a paid feature");
  assert.equal(stripped.branding.hideAideBranding, false);
  assert.equal(stripped.identity.greetingTitle, "Welcome");
  assert.equal(stripped.appearance.primaryColor, "#112233");
  assert.equal(stripped.home.links.length, 1);
});

test("white-label plans: paid + active, or admin", () => {
  assert.equal(isWhiteLabelPlan({ unlocked: true, planType: "POPULAR" }), true);
  assert.equal(isWhiteLabelPlan({ unlocked: true, planType: "TEAMS" }), true);
  assert.equal(isWhiteLabelPlan({ unlocked: true, planType: "FREE" }), false);
  assert.equal(isWhiteLabelPlan({ unlocked: false, planType: "POPULAR" }), false);
  assert.equal(isWhiteLabelPlan({ role: "ADMIN" }), true);
});

test("launcher defaults to the original AIDE launcher; geometry drives the host frame", async () => {
  const { launcherBox, launcherFrame } = await import("@/lib/customization/launcher");
  const merged = mergeCustomization({});
  assert.equal(merged.deploy.launcherShape, "pill");
  assert.equal(merged.deploy.launcherBorder, "gradient");
  assert.deepEqual(launcherBox(merged.deploy), { shape: "pill", size: "md", width: 68, height: 40, radius: 16 });
  assert.deepEqual(launcherFrame(merged.deploy), { width: 80, height: 56 });
  assert.deepEqual(launcherFrame({ launcherShape: "circle", launcherSize: "lg" }), { width: 80, height: 80 });
  assert.equal(launcherBox({ launcherShape: "bogus" }).shape, "pill");
  assert.equal(customizationSchema.safeParse({ deploy: { launcherBorderColor: "red" } }).success, false);
  assert.equal(customizationSchema.safeParse({ deploy: { launcherShape: "circle", launcherBorder: "none", launcherBorderColor: null } }).success, true);
});
