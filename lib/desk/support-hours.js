/**
 * B6 — support hours: is a human team expected to be around right now, and what the handoff
 * message says when not. Pure; the desk flow (WAITING_HUMAN, aiPaused, assignment) is unchanged.
 */

import { DESK_HANDOFF_ACK_MESSAGE } from "./conversation-desk.js";

export const SUPPORT_DAYS = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"];
const DAY_LABELS = { mon: "Mon", tue: "Tue", wed: "Wed", thu: "Thu", fri: "Fri", sat: "Sat", sun: "Sun" };
const WEEKDAY_FROM_INTL = { Mon: "mon", Tue: "tue", Wed: "wed", Thu: "thu", Fri: "fri", Sat: "sat", Sun: "sun" };

export const DEFAULT_SUPPORT_HOURS = Object.freeze({
  /** Off by default: every handoff keeps today's "someone will join" message. */
  hoursEnabled: false,
  timezone: "UTC",
  weekly: ["mon", "tue", "wed", "thu", "fri"].map((day) => ({ day, open: "09:00", close: "18:00" })),
  /** Empty = the default offline message below. */
  offlineMessage: "",
});

export const TIME_PATTERN = /^(([01]\d|2[0-3]):[0-5]\d|24:00)$/;

/** "HH:MM" → minutes since midnight ("24:00" = 1440); null when malformed. */
export function toMinutes(value) {
  if (typeof value !== "string" || !TIME_PATTERN.test(value)) return null;
  const [hours, minutes] = value.split(":").map(Number);
  return hours * 60 + minutes;
}

export function isValidTimeZone(timeZone) {
  if (typeof timeZone !== "string" || !timeZone.trim()) return false;
  try {
    new Intl.DateTimeFormat("en-US", { timeZone });
    return true;
  } catch {
    return false;
  }
}

/** Weekday + minutes-since-midnight at `now` in `timeZone`; null for an invalid zone. */
export function localDayAndMinutes(now, timeZone) {
  if (!isValidTimeZone(timeZone)) return null;
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(now);
  const get = (type) => parts.find((part) => part.type === type)?.value;
  const day = WEEKDAY_FROM_INTL[get("weekday")];
  const hour = Number(get("hour"));
  const minute = Number(get("minute"));
  if (!day || !Number.isFinite(hour) || !Number.isFinite(minute)) return null;
  return { day, minutes: (hour % 24) * 60 + minute };
}

function previousDay(day) {
  const index = SUPPORT_DAYS.indexOf(day);
  return SUPPORT_DAYS[(index + SUPPORT_DAYS.length - 1) % SUPPORT_DAYS.length];
}

/**
 * True when the team is expected to be available. Fail-open: hours off, an invalid timezone or a
 * malformed schedule all count as open, so a settings mistake never hides the team.
 * Overnight ranges (close ≤ open, e.g. 22:00–06:00) continue into the next morning.
 */
export function isWithinSupportHours(support, now = new Date()) {
  if (!support?.hoursEnabled) return true;
  const local = localDayAndMinutes(now, support.timezone);
  if (!local) return true;
  const ranges = (Array.isArray(support.weekly) ? support.weekly : [])
    .map((range) => ({ day: range?.day, open: toMinutes(range?.open), close: toMinutes(range?.close) }))
    .filter((range) => SUPPORT_DAYS.includes(range.day) && range.open !== null && range.close !== null);
  if (!ranges.length) return true;
  const yesterday = previousDay(local.day);
  return ranges.some((range) => {
    const overnight = range.close <= range.open;
    if (range.day === local.day) {
      return overnight ? local.minutes >= range.open : local.minutes >= range.open && local.minutes < range.close;
    }
    return overnight && range.day === yesterday && local.minutes < range.close;
  });
}

/** "Mon–Fri 09:00–18:00, Sat 10:00–14:00 (Asia/Karachi)"; empty when nothing valid is set. */
export function formatSupportHours(support) {
  const ranges = (Array.isArray(support?.weekly) ? support.weekly : [])
    .filter((range) => SUPPORT_DAYS.includes(range?.day) && toMinutes(range?.open) !== null && toMinutes(range?.close) !== null)
    .sort((a, b) => SUPPORT_DAYS.indexOf(a.day) - SUPPORT_DAYS.indexOf(b.day));
  if (!ranges.length) return "";
  const groups = [];
  for (const range of ranges) {
    const last = groups[groups.length - 1];
    const consecutive = last && SUPPORT_DAYS.indexOf(range.day) === SUPPORT_DAYS.indexOf(last.to) + 1;
    if (last && consecutive && last.open === range.open && last.close === range.close) last.to = range.day;
    else groups.push({ from: range.day, to: range.day, open: range.open, close: range.close });
  }
  const text = groups
    .map((g) => `${DAY_LABELS[g.from]}${g.to !== g.from ? `–${DAY_LABELS[g.to]}` : ""} ${g.open}–${g.close}`)
    .join(", ");
  return isValidTimeZone(support?.timezone) ? `${text} (${support.timezone})` : text;
}

/** Offline text used when the owner left the offline message empty. */
export function defaultOfflineMessage(support) {
  const hours = formatSupportHours(support);
  return `Our team is offline right now${hours ? ` (hours: ${hours})` : ""}. Your message is saved and a teammate will reply here when we're back.`;
}

/** The message a customer sees when a handoff is created at `now`. */
export function handoffAckMessage(support, now = new Date()) {
  if (isWithinSupportHours(support, now)) return DESK_HANDOFF_ACK_MESSAGE;
  const custom = String(support?.offlineMessage || "").trim();
  return custom ? custom.slice(0, 400) : defaultOfflineMessage(support);
}
