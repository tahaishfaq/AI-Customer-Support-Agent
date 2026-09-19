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
  buildHs256JwtSetUserSnippet,
  describeIdentityStrategies,
} from "@/lib/embed/identity-merchant";

/**
 * Deploy-tab guide: how merchants bind signed-in visitors for ACCOUNT tools.
 */
export function EmbedIdentityGuide() {
  const strategies = describeIdentityStrategies();
  const hostSnippet = buildHostSessionSetUserSnippet();
  const jwtSnippet = buildHs256JwtSetUserSnippet();
  const [copied, setCopied] = useState(null);

  async function copySnippet(which, text) {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(which);
      toast.success("Snippet copied");
      setTimeout(() => setCopied(null), 2000);
    } catch {
      toast.error("Could not copy");
    }
  }

  return (
    <FormSection title="Signed-in visitors">
      <FieldBlock
        label="Why this matters"
        hint="ACCOUNT_READ / ACCOUNT_WRITE on the public embed need an Aide-signed HS256 JWT from your backend. Browser setUser subject alone is not enough. Guests can still use public or GUEST_LOOKUP tools."
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
        label="Aide-signed JWT (required for ACCOUNT tools)"
        hint="Mint on your server with ACTIONS_IDENTITY_SECRET (or owner mint API). Never put the secret in the browser."
      >
        <div className="overflow-hidden rounded-xl border border-border bg-zinc-950">
          <div className="flex justify-end border-b border-white/10 px-2 py-1.5">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-7 px-2 text-zinc-200 hover:bg-white/10 hover:text-white"
              onClick={() => copySnippet("jwt", jwtSnippet)}
            >
              {copied === "jwt" ? (
                <Check data-icon="inline-start" className="text-emerald-400" />
              ) : (
                <Copy data-icon="inline-start" />
              )}
              {copied === "jwt" ? "Copied" : "Copy"}
            </Button>
          </div>
          <pre className="overflow-x-auto p-3 text-[11px] leading-relaxed text-zinc-200">
            <code>{jwtSnippet}</code>
          </pre>
        </div>
      </FieldBlock>

      <FieldBlock
        label="Host setUser (display / outbound token)"
        hint="Optional for display name and merchant outbound Bearer. Does not authorize ACCOUNT tools by itself."
      >
        <div className="overflow-hidden rounded-xl border border-border bg-zinc-950">
          <div className="flex justify-end border-b border-white/10 px-2 py-1.5">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-7 px-2 text-zinc-200 hover:bg-white/10 hover:text-white"
              onClick={() => copySnippet("host", hostSnippet)}
            >
              {copied === "host" ? (
                <Check data-icon="inline-start" className="text-emerald-400" />
              ) : (
                <Copy data-icon="inline-start" />
              )}
              {copied === "host" ? "Copied" : "Copy"}
            </Button>
          </div>
          <pre className="overflow-x-auto p-3 text-[11px] leading-relaxed text-zinc-200">
            <code>{hostSnippet}</code>
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
