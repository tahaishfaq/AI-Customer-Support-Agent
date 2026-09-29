"use client";

import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import {
  MAX_PROACTIVE_RULES,
  PROACTIVE_DELAY_MAX,
  PROACTIVE_MESSAGE_MAX,
  normalizeProactiveRules,
} from "@/lib/embed/proactive-rules";

const selectClass = "h-9 w-full rounded-lg border border-border bg-card px-2 text-sm";

const MATCH_OPTIONS = [
  ["any", "Every page"],
  ["contains", "Page path contains"],
  ["prefix", "Page path starts with"],
];
const AUDIENCE_OPTIONS = [
  ["all", "Everyone"],
  ["identified", "Logged-in customers"],
  ["anonymous", "Guests only"],
];
const FREQUENCY_OPTIONS = [
  ["every_page", "On every matching page"],
  ["once_per_session", "Once per visit"],
  ["once_per_visitor", "Once per visitor"],
];

function newRuleId() {
  return `p_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
}

/**
 * The old single message fields are kept in step for widgets still running older code: they show
 * only an "every page, everyone" rule (so a page-targeted rule is never shown everywhere).
 */
function legacyFields(rules) {
  const generic = rules.find((rule) => rule.enabled && rule.match === "any" && rule.audience === "all");
  return generic
    ? { proactiveEnabled: true, proactiveMessage: generic.message }
    : { proactiveEnabled: false };
}

/** Level 2 · P6 — targeted proactive messages (page, audience, delay, frequency). */
export function ProactiveRulesEditor({ deploy, patch }) {
  const rules = Array.isArray(deploy.proactiveRules) && deploy.proactiveRules.length
    ? deploy.proactiveRules
    : normalizeProactiveRules(deploy); // the old single message shows as the first rule

  function save(next) {
    patch({ proactiveRules: next, ...legacyFields(next) });
  }

  function update(id, partial) {
    save(rules.map((rule) => (rule.id === id ? { ...rule, ...partial } : rule)));
  }

  return (
    <div className="flex flex-col gap-3">
      {rules.length === 0 ? (
        <p className="rounded-lg border border-dashed border-border px-4 py-5 text-center text-sm text-muted-foreground">
          No proactive messages. Add one to greet visitors on specific pages.
        </p>
      ) : (
        <ul className="flex flex-col gap-3">
          {rules.map((rule, index) => {
            const label = `Message ${index + 1}`;
            return (
              <li key={rule.id} className="rounded-xl border border-border bg-muted/30 p-3">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-xs font-semibold text-foreground">{label}</p>
                  <div className="flex items-center gap-1">
                    <Switch
                      checked={rule.enabled !== false}
                      onCheckedChange={(enabled) => update(rule.id, { enabled })}
                      aria-label={`${label} enabled`}
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      aria-label={`Delete ${label.toLowerCase()}`}
                      onClick={() => save(rules.filter((item) => item.id !== rule.id))}
                    >
                      <Trash2 className="size-4" aria-hidden />
                    </Button>
                  </div>
                </div>
                <Textarea
                  value={rule.message || ""}
                  maxLength={PROACTIVE_MESSAGE_MAX}
                  rows={2}
                  onChange={(event) => update(rule.id, { message: event.target.value })}
                  placeholder="Questions about pricing? We can help."
                  aria-label={`${label} text`}
                  className="mt-2"
                />
                <div className="mt-2 grid gap-2 sm:grid-cols-2">
                  <label className="flex flex-col gap-1 text-[11px] font-medium text-muted-foreground">
                    Show on
                    <select
                      className={selectClass}
                      value={rule.match || "any"}
                      onChange={(event) => update(rule.id, { match: event.target.value })}
                    >
                      {MATCH_OPTIONS.map(([value, text]) => (
                        <option key={value} value={value}>
                          {text}
                        </option>
                      ))}
                    </select>
                  </label>
                  {rule.match && rule.match !== "any" ? (
                    <label className="flex flex-col gap-1 text-[11px] font-medium text-muted-foreground">
                      Page path
                      <Input
                        value={rule.path || ""}
                        maxLength={200}
                        onChange={(event) => update(rule.id, { path: event.target.value })}
                        placeholder={rule.match === "prefix" ? "/pricing" : "checkout"}
                        className="h-9"
                      />
                    </label>
                  ) : null}
                  <label className="flex flex-col gap-1 text-[11px] font-medium text-muted-foreground">
                    Who sees it
                    <select
                      className={selectClass}
                      value={rule.audience || "all"}
                      onChange={(event) => update(rule.id, { audience: event.target.value })}
                    >
                      {AUDIENCE_OPTIONS.map(([value, text]) => (
                        <option key={value} value={value}>
                          {text}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="flex flex-col gap-1 text-[11px] font-medium text-muted-foreground">
                    How often
                    <select
                      className={selectClass}
                      value={rule.frequency || "every_page"}
                      onChange={(event) => update(rule.id, { frequency: event.target.value })}
                    >
                      {FREQUENCY_OPTIONS.map(([value, text]) => (
                        <option key={value} value={value}>
                          {text}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="flex flex-col gap-1 text-[11px] font-medium text-muted-foreground">
                    Delay (seconds)
                    <Input
                      type="number"
                      min={0}
                      max={PROACTIVE_DELAY_MAX}
                      value={Number.isFinite(rule.delaySeconds) ? rule.delaySeconds : 0}
                      onChange={(event) => {
                        const value = Math.round(Number(event.target.value));
                        update(rule.id, {
                          delaySeconds: Number.isFinite(value) ? Math.min(Math.max(value, 0), PROACTIVE_DELAY_MAX) : 0,
                        });
                      }}
                      className="h-9"
                    />
                  </label>
                </div>
              </li>
            );
          })}
        </ul>
      )}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-[11px] text-muted-foreground">
          The first matching message is shown next to the chat button; it never opens the chat by itself. Visitors can
          dismiss it.
        </p>
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={rules.length >= MAX_PROACTIVE_RULES}
          onClick={() =>
            save([
              ...rules,
              {
                id: newRuleId(),
                enabled: true,
                message: "Hi! Need help?",
                match: "any",
                path: "",
                delaySeconds: 5,
                audience: "all",
                frequency: "once_per_session",
              },
            ])
          }
        >
          <Plus className="size-4" aria-hidden /> Add message
        </Button>
      </div>
    </div>
  );
}
