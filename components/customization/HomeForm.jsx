"use client";

import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { FieldBlock, FormSection, MiniLabel, fieldClass } from "@/components/customization/CustomizationFields";

const MAX_LINKS = 5;
const STATUS_LEVELS = [
  { value: "operational", label: "Operational" },
  { value: "degraded", label: "Degraded performance" },
  { value: "maintenance", label: "Maintenance" },
];

const isHttps = (value) => /^https:\/\/\S+$/i.test(String(value || "").trim());

export function HomeForm({ home, onChange }) {
  const links = Array.isArray(home?.links) ? home.links : [];
  const status = home?.status || {};

  function patch(partial) {
    onChange({ ...home, ...partial });
  }
  function patchLink(index, partial) {
    patch({ links: links.map((link, i) => (i === index ? { ...link, ...partial } : link)) });
  }
  function patchStatus(partial) {
    patch({ status: { ...status, ...partial } });
  }

  return (
    <div className="space-y-6">
      <FormSection title="Link cards">
        <FieldBlock
          label="Home links"
          hint={`Cards under "Send us a message" (help center, docs, products). Opens in a new tab. Up to ${MAX_LINKS}.`}
        >
          <div className="flex flex-col gap-3">
            {links.map((link, index) => (
              <div key={index} className="grid gap-2 sm:grid-cols-[1fr_1.4fr_auto] sm:items-end">
                <div>
                  <MiniLabel htmlFor={`home-link-label-${index}`}>Label</MiniLabel>
                  <Input
                    id={`home-link-label-${index}`}
                    value={link.label}
                    maxLength={40}
                    onChange={(e) => patchLink(index, { label: e.target.value })}
                    placeholder="Help Center"
                    className={fieldClass}
                  />
                </div>
                <div>
                  <MiniLabel htmlFor={`home-link-url-${index}`}>URL</MiniLabel>
                  <Input
                    id={`home-link-url-${index}`}
                    value={link.url}
                    onChange={(e) => patchLink(index, { url: e.target.value })}
                    placeholder="https://help.example.com"
                    aria-invalid={link.url && !isHttps(link.url) ? true : undefined}
                    className={fieldClass}
                  />
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  aria-label={`Remove link ${link.label || index + 1}`}
                  onClick={() => patch({ links: links.filter((_, i) => i !== index) })}
                >
                  <Trash2 className="size-4" aria-hidden />
                </Button>
              </div>
            ))}
            {links.some((link) => link.url && !isHttps(link.url)) ? (
              <p className="text-xs text-destructive">Links must start with https://</p>
            ) : null}
            {links.length < MAX_LINKS ? (
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="w-fit gap-1.5"
                onClick={() => patch({ links: [...links, { label: "", url: "" }] })}
              >
                <Plus className="size-4" aria-hidden />
                Add link
              </Button>
            ) : null}
          </div>
        </FieldBlock>
      </FormSection>

      <FormSection title="Status card">
        <FieldBlock label="Service status" hint="Show your current status on Home. You set it here — update it during incidents.">
          <div className="flex items-center justify-between gap-3">
            <MiniLabel htmlFor="home-status-enabled">Show status card</MiniLabel>
            <Switch
              id="home-status-enabled"
              checked={Boolean(status.enabled)}
              onCheckedChange={(enabled) => patchStatus({ enabled })}
            />
          </div>
          {status.enabled ? (
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              <div>
                <MiniLabel htmlFor="home-status-level">Status</MiniLabel>
                <Select
                  items={STATUS_LEVELS}
                  value={status.level || "operational"}
                  onValueChange={(level) => {
                    if (level) patchStatus({ level });
                  }}
                >
                  <SelectTrigger id="home-status-level" className={fieldClass}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {STATUS_LEVELS.map((item) => (
                      <SelectItem key={item.value} value={item.value}>
                        {item.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <MiniLabel htmlFor="home-status-message">Message</MiniLabel>
                <Input
                  id="home-status-message"
                  value={status.message}
                  maxLength={120}
                  onChange={(e) => patchStatus({ message: e.target.value })}
                  placeholder="We're fully operational."
                  className={fieldClass}
                />
              </div>
              <div className="sm:col-span-2">
                <MiniLabel htmlFor="home-status-url">Status page URL (optional)</MiniLabel>
                <Input
                  id="home-status-url"
                  value={status.url || ""}
                  onChange={(e) => patchStatus({ url: e.target.value })}
                  placeholder="https://status.example.com"
                  aria-invalid={status.url && !isHttps(status.url) ? true : undefined}
                  className={fieldClass}
                />
                <p className="mt-1 text-xs text-muted-foreground">Adds a “Subscribe to updates” button.</p>
              </div>
            </div>
          ) : null}
        </FieldBlock>
      </FormSection>
    </div>
  );
}
