"use client";

import { useState } from "react";
import { Check, Copy } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  FieldBlock,
  FormSection,
} from "@/components/customization/CustomizationFields";
import {
  IDENTITY_PRODUCT_RULES,
  buildHostSessionSetUserSnippet,
  describeIdentityStrategies,
} from "@/lib/embed/identity-merchant";

/**
 * Deploy-tab guide: how merchants bind signed-in visitors for ACCOUNT tools.
 */
export function EmbedIdentityGuide() {
  const strategies = describeIdentityStrategies();
  const snippet = buildHostSessionSetUserSnippet();
  const [copied, setCopied] = useState(false);

  async function copySnippet() {
    try {
      await navigator.clipboard.writeText(snippet);
      setCopied(true);
      toast.success("setUser snippet copied");
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("Could not copy");
    }
  }

  return (
    <FormSection title="Signed-in visitors">
      <FieldBlock
        label="Why this matters"
        hint="ACCOUNT_READ / ACCOUNT_WRITE tools (my order, my ticket) need aideChat.setUser. Guests can still use public or GUEST_LOOKUP tools."
      >
        <ul className="space-y-1.5 text-sm text-muted-foreground">
          {strategies.map((s) => (
            <li key={s.id}>
              <span className="font-medium text-foreground">{s.title}.</span>{" "}
              {s.summary}
            </li>
          ))}
        </ul>
      </FieldBlock>

      <FieldBlock
        label="Host setUser snippet"
        hint="Paste after your site login on every page load while the user is signed in. Setting window.__AIDE_CHAT_USER__ is enough — embed.js calls setUser for you."
      >
        <div className="overflow-hidden rounded-xl border border-border bg-zinc-950">
          <div className="flex justify-end border-b border-white/10 px-2 py-1.5">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-7 px-2 text-zinc-200 hover:bg-white/10 hover:text-white"
              onClick={copySnippet}
            >
              {copied ? (
                <Check data-icon="inline-start" className="text-emerald-400" />
              ) : (
                <Copy data-icon="inline-start" />
              )}
              {copied ? "Copied" : "Copy"}
            </Button>
          </div>
          <pre className="overflow-x-auto p-3 text-[11px] leading-relaxed text-zinc-200">
            <code>{snippet}</code>
          </pre>
        </div>
      </FieldBlock>

      <FieldBlock label="Rules">
        <ul className="list-disc space-y-1 pl-4 text-xs text-muted-foreground">
          {IDENTITY_PRODUCT_RULES.map((rule) => (
            <li key={rule}>{rule}</li>
          ))}
        </ul>
        <p className="mt-2 text-xs text-muted-foreground">
          Full guide:{" "}
          <code className="text-[11px]">docs/features/EMBED_END_USER_IDENTITY.md</code>
        </p>
      </FieldBlock>
    </FormSection>
  );
}
