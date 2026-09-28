/**
 * B6 — support hours decide the handoff message; the desk flow itself is unchanged.
 * Run: npm run test:support-hours
 */
import assert from "node:assert/strict";
import { test } from "node:test";
import {
  DEFAULT_SUPPORT_HOURS,
  defaultOfflineMessage,
  formatSupportHours,
  handoffAckMessage,
  isWithinSupportHours,
  localDayAndMinutes,
} from "../lib/desk/support-hours.js";
import { DESK_HANDOFF_ACK_MESSAGE } from "../lib/desk/conversation-desk.js";
import { DEFAULT_CUSTOMIZATION, applyCustomizationPatch, mergeCustomization } from "../lib/customization/defaults.js";
import { customizationSchema } from "../lib/validations/customization.js";

const karachi = (weekly, extra = {}) => ({ hoursEnabled: true, timezone: "Asia/Karachi", weekly, ...extra });
const weekdays = ["mon", "tue", "wed", "thu", "fri"].map((day) => ({ day, open: "09:00", close: "18:00" }));
// 2026-09-28 is a Monday. Karachi = UTC+5 (no DST).
const at = (iso) => new Date(iso);

test("hours off (default) keeps today's handoff message exactly", () => {
  assert.equal(DEFAULT_SUPPORT_HOURS.hoursEnabled, false);
  assert.equal(isWithinSupportHours(DEFAULT_SUPPORT_HOURS, at("2026-09-27T03:00:00Z")), true);
  assert.equal(handoffAckMessage(DEFAULT_SUPPORT_HOURS, at("2026-09-27T03:00:00Z")), DESK_HANDOFF_ACK_MESSAGE);
  assert.equal(handoffAckMessage(undefined), DESK_HANDOFF_ACK_MESSAGE);
});

test("inside vs outside hours in the agent's timezone", () => {
  const support = karachi(weekdays);
  assert.deepEqual(localDayAndMinutes(at("2026-09-28T05:00:00Z"), "Asia/Karachi"), { day: "mon", minutes: 600 });
  assert.equal(isWithinSupportHours(support, at("2026-09-28T05:00:00Z")), true, "Mon 10:00 PKT");
  assert.equal(isWithinSupportHours(support, at("2026-09-28T03:59:00Z")), false, "Mon 08:59 PKT");
  assert.equal(isWithinSupportHours(support, at("2026-09-28T04:00:00Z")), true, "Mon 09:00 opens");
  assert.equal(isWithinSupportHours(support, at("2026-09-28T13:00:00Z")), false, "Mon 18:00 closed (end exclusive)");
  assert.equal(isWithinSupportHours(support, at("2026-09-27T06:00:00Z")), false, "Sunday closed");
  const offline = handoffAckMessage(support, at("2026-09-27T06:00:00Z"));
  assert.match(offline, /offline right now \(hours: Mon–Fri 09:00–18:00 \(Asia\/Karachi\)\)/);
  assert.equal(handoffAckMessage(support, at("2026-09-28T05:00:00Z")), DESK_HANDOFF_ACK_MESSAGE);
});

test("overnight ranges continue into the next morning; 24:00 closes at midnight", () => {
  const night = karachi([{ day: "fri", open: "22:00", close: "06:00" }]);
  assert.equal(isWithinSupportHours(night, at("2026-10-02T18:00:00Z")), true, "Fri 23:00");
  assert.equal(isWithinSupportHours(night, at("2026-10-02T23:30:00Z")), true, "Sat 04:30 (from Friday's range)");
  assert.equal(isWithinSupportHours(night, at("2026-10-03T01:30:00Z")), false, "Sat 06:30");
  assert.equal(isWithinSupportHours(night, at("2026-10-02T16:00:00Z")), false, "Fri 21:00");
  const allDay = karachi([{ day: "mon", open: "00:00", close: "24:00" }]);
  assert.equal(isWithinSupportHours(allDay, at("2026-09-28T18:59:00Z")), true, "Mon 23:59");
  assert.equal(isWithinSupportHours(allDay, at("2026-09-28T19:00:00Z")), false, "Tue 00:00");
});

test("fail-open: invalid timezone, empty or malformed schedule never hide the team", () => {
  assert.equal(isWithinSupportHours(karachi(weekdays, { timezone: "Mars/Olympus" }), at("2026-09-27T06:00:00Z")), true);
  assert.equal(isWithinSupportHours(karachi([]), at("2026-09-27T06:00:00Z")), true);
  assert.equal(isWithinSupportHours(karachi([{ day: "funday", open: "9", close: "x" }]), at("2026-09-27T06:00:00Z")), true);
  assert.equal(localDayAndMinutes(new Date(), "Not/AZone"), null);
});

test("DST: London hours follow local clock time", () => {
  const london = { hoursEnabled: true, timezone: "Europe/London", weekly: [{ day: "mon", open: "09:00", close: "10:00" }] };
  assert.equal(isWithinSupportHours(london, at("2026-06-29T08:30:00Z")), true, "BST: 09:30 local");
  assert.equal(isWithinSupportHours(london, at("2026-12-28T08:30:00Z")), false, "GMT: 08:30 local");
  assert.equal(isWithinSupportHours(london, at("2026-12-28T09:30:00Z")), true, "GMT: 09:30 local");
});

test("custom offline message, formatting and default text", () => {
  const custom = karachi(weekdays, { offlineMessage: "  Back Monday 9am. We'll reply here.  " });
  assert.equal(handoffAckMessage(custom, at("2026-09-27T06:00:00Z")), "Back Monday 9am. We'll reply here.");
  assert.equal(handoffAckMessage(karachi(weekdays, { offlineMessage: "x".repeat(900) }), at("2026-09-27T06:00:00Z")).length, 400);
  assert.equal(
    formatSupportHours(karachi([...weekdays, { day: "sat", open: "10:00", close: "14:00" }])),
    "Mon–Fri 09:00–18:00, Sat 10:00–14:00 (Asia/Karachi)"
  );
  assert.equal(formatSupportHours(karachi([{ day: "mon", open: "09:00", close: "18:00" }, { day: "wed", open: "09:00", close: "18:00" }])), "Mon 09:00–18:00, Wed 09:00–18:00 (Asia/Karachi)");
  assert.equal(formatSupportHours({ weekly: [] }), "");
  assert.equal(defaultOfflineMessage({ weekly: [] }), "Our team is offline right now. Your message is saved and a teammate will reply here when we're back.");
});

test("settings: defaults, patch merge and validation", () => {
  assert.equal(mergeCustomization({}).support.hoursEnabled, false);
  assert.equal(JSON.stringify(mergeCustomization({})), JSON.stringify(DEFAULT_CUSTOMIZATION), "untouched stays default");
  const patched = applyCustomizationPatch({}, { support: { hoursEnabled: true, timezone: "Asia/Karachi" } });
  assert.equal(patched.support.hoursEnabled, true);
  assert.equal(patched.support.weekly.length, 5, "weekly defaults kept when not patched");
  assert.equal(customizationSchema.safeParse({ support: karachi(weekdays) }).success, true);
  assert.equal(customizationSchema.safeParse({ support: { timezone: "Mars/Olympus" } }).success, false);
  assert.equal(customizationSchema.safeParse({ support: { weekly: [{ day: "mon", open: "9am", close: "18:00" }] } }).success, false);
  assert.equal(customizationSchema.safeParse({ support: { weekly: [{ day: "funday", open: "09:00", close: "18:00" }] } }).success, false);
  assert.equal(customizationSchema.safeParse({ support: { offlineMessage: "x".repeat(401) } }).success, false);
  assert.deepEqual(customizationSchema.parse({ support: { hoursEnabled: true, extra: 1 } }).support, { hoursEnabled: true }, "unknown keys stripped");
});
