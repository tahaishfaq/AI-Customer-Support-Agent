"use client";

import { Clock } from "lucide-react";
import { FieldBlock, FormSection, areaClass, fieldClass } from "@/components/customization/CustomizationFields";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import {
  SUPPORT_DAYS,
  defaultOfflineMessage,
  formatSupportHours,
  isValidTimeZone,
  isWithinSupportHours,
} from "@/lib/desk/support-hours";

const DAY_NAMES = { mon: "Monday", tue: "Tuesday", wed: "Wednesday", thu: "Thursday", fri: "Friday", sat: "Saturday", sun: "Sunday" };

function browserTimeZone() {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
  } catch {
    return "UTC";
  }
}

/** When the human team is available, and what customers see if they ask for one outside those hours. */
export function SupportHoursForm({ support, onChange }) {
  const value = support || {};
  const weekly = Array.isArray(value.weekly) ? value.weekly : [];
  const timezoneValid = isValidTimeZone(value.timezone);

  function patch(partial) {
    onChange({ ...value, ...partial });
  }

  function setDay(day, enabled) {
    const rest = weekly.filter((range) => range.day !== day);
    patch({ weekly: enabled ? [...rest, { day, open: "09:00", close: "18:00" }] : rest });
  }

  function setTime(day, key, time) {
    patch({ weekly: weekly.map((range) => (range.day === day ? { ...range, [key]: time } : range)) });
  }

  const openNow = isWithinSupportHours(value);
  const summary = formatSupportHours(value);

  return (
    <FormSection title="Support hours">
      <div className="rounded-xl border border-border bg-muted/30 p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-sm font-semibold text-foreground">Use support hours</p>
            <p className="mt-0.5 text-xs leading-snug text-muted-foreground">
              Off: a handoff always says a teammate will join. On: outside these hours customers are told the team is
              offline and will reply in the chat.
            </p>
          </div>
          <Switch checked={Boolean(value.hoursEnabled)} onCheckedChange={(hoursEnabled) => patch({ hoursEnabled })} />
        </div>
        {value.hoursEnabled ? (
          <p className="mt-3 flex items-center gap-1.5 text-xs text-muted-foreground" aria-live="polite">
            <Clock className="size-3.5" aria-hidden />
            {openNow ? "Open right now" : "Offline right now"}
            {summary ? ` · ${summary}` : ""}
          </p>
        ) : null}
      </div>

      {value.hoursEnabled ? (
        <>
          <FieldBlock label="Timezone" hint="IANA name, e.g. Asia/Karachi or Europe/London.">
            <div className="flex gap-2">
              <Input
                className={fieldClass}
                value={value.timezone || ""}
                onChange={(event) => patch({ timezone: event.target.value })}
                aria-invalid={!timezoneValid || undefined}
                placeholder="Asia/Karachi"
                spellCheck={false}
              />
              <button
                type="button"
                className="shrink-0 rounded-lg border border-border bg-card px-3 text-xs font-medium hover:bg-muted"
                onClick={() => patch({ timezone: browserTimeZone() })}
              >
                Use mine
              </button>
            </div>
            {!timezoneValid ? (
              <p className="mt-1.5 text-xs text-destructive">Unknown timezone — hours are ignored until it is fixed.</p>
            ) : null}
          </FieldBlock>

          <FieldBlock label="Weekly hours" hint="Closing earlier than opening runs past midnight (e.g. 22:00–06:00).">
            <ul className="space-y-2">
              {SUPPORT_DAYS.map((day) => {
                const range = weekly.find((item) => item.day === day);
                return (
                  <li key={day} className="flex flex-wrap items-center gap-2">
                    <label className="flex w-32 items-center gap-2 text-sm">
                      <Checkbox checked={Boolean(range)} onCheckedChange={(checked) => setDay(day, Boolean(checked))} />
                      {DAY_NAMES[day]}
                    </label>
                    {range ? (
                      <>
                        <Input
                          type="time"
                          className={`${fieldClass} w-28`}
                          value={range.open}
                          onChange={(event) => setTime(day, "open", event.target.value)}
                          aria-label={`${DAY_NAMES[day]} opening time`}
                        />
                        <span className="text-xs text-muted-foreground">to</span>
                        <Input
                          type="time"
                          className={`${fieldClass} w-28`}
                          value={range.close}
                          onChange={(event) => setTime(day, "close", event.target.value)}
                          aria-label={`${DAY_NAMES[day]} closing time`}
                        />
                      </>
                    ) : (
                      <span className="text-xs text-muted-foreground">Closed</span>
                    )}
                  </li>
                );
              })}
            </ul>
          </FieldBlock>

          <FieldBlock label="Offline message" hint="Shown when a customer asks for a person outside these hours. Leave empty for the default.">
            <Textarea
              className={areaClass}
              value={value.offlineMessage || ""}
              maxLength={400}
              onChange={(event) => patch({ offlineMessage: event.target.value })}
              placeholder={defaultOfflineMessage(value)}
            />
          </FieldBlock>
        </>
      ) : null}
    </FormSection>
  );
}
