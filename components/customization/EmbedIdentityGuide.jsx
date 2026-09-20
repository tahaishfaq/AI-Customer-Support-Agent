"use client";

import { useState } from "react";
import { Check, ChevronRight, Copy, UserRound } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  FieldBlock,
  FormSection,
} from "@/components/customization/CustomizationFields";
import {
  buildHostSessionSetUserSnippet,
  buildHs256JwtSetUserSnippet,
} from "@/lib/embed/identity-merchant";
import { cn } from "@/lib/utils";

function CodeBlock({ id, text, copied, onCopy }) {
  return (
    <div className="overflow-hidden rounded-xl border border-border bg-zinc-950">
      <div className="flex justify-end border-b border-white/10 px-2 py-1.5">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-7 px-2 text-zinc-200 hover:bg-white/10 hover:text-white"
          onClick={() => onCopy(id, text)}
        >
          {copied === id ? (
            <Check data-icon="inline-start" className="text-emerald-400" />
          ) : (
            <Copy data-icon="inline-start" />
          )}
          {copied === id ? "Copied" : "Copy"}
        </Button>
      </div>
      <pre className="overflow-x-auto p-3 text-[11px] leading-relaxed text-zinc-200">
        <code>{text}</code>
      </pre>
    </div>
  );
}

/**
 * Optional identity help — collapsed by default so Deploy stays install-first.
 */
export function EmbedIdentityGuide() {
  const hostSnippet = buildHostSessionSetUserSnippet();
  const jwtSnippet = buildHs256JwtSetUserSnippet();
  const [copied, setCopied] = useState(null);
  const [showNameCode, setShowNameCode] = useState(false);
  const [showAccountCode, setShowAccountCode] = useState(false);

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
    <FormSection title="Logged-in customers">
      <p className="text-sm text-muted-foreground">
        Most sites can skip this. The embed script above already runs chat for
        visitors. Open this only if the bot should know who is signed in on your
        site.
      </p>

      <Collapsible
        defaultOpen={false}
        className="group overflow-hidden rounded-xl border border-border bg-muted/20"
      >
        <CollapsibleTrigger className="flex w-full items-start gap-2 px-3 py-3 text-left outline-none hover:bg-muted/40 focus-visible:ring-2 focus-visible:ring-ring/40">
          <ChevronRight className="mt-0.5 size-4 shrink-0 text-muted-foreground transition-transform duration-200 group-data-[open]:rotate-90" />
          <span className="min-w-0 flex-1">
            <span className="flex items-center gap-2 text-sm font-medium text-foreground">
              <UserRound className="size-3.5 text-muted-foreground" aria-hidden />
              Optional setup
            </span>
            <span className="mt-0.5 block text-xs text-muted-foreground">
              Show their name, or answer “my order / my account” questions.
            </span>
          </span>
        </CollapsibleTrigger>

        <CollapsibleContent>
          <div className="space-y-4 border-t border-border px-3 py-3">
            <FieldBlock
              label="1. Show their name in chat"
              hint="Nice-to-have. Paste after your site login. Does not unlock order or account tools by itself."
            >
              <Button
                type="button"
                variant="outline"
                size="sm"
                className={cn(showNameCode && "bg-muted")}
                onClick={() => setShowNameCode((v) => !v)}
              >
                {showNameCode ? "Hide code" : "Show code"}
              </Button>
              {showNameCode ? (
                <div className="mt-2">
                  <CodeBlock
                    id="host"
                    text={hostSnippet}
                    copied={copied}
                    onCopy={copySnippet}
                  />
                </div>
              ) : null}
            </FieldBlock>

            <FieldBlock
              label="2. Answer order or account questions"
              hint="Your backend issues a short-lived signed pass for the logged-in user. Never put secrets in the browser."
            >
              <ol className="mb-2 list-decimal space-y-1 pl-4 text-sm text-muted-foreground">
                <li>Customer logs into your website.</li>
                <li>Your server creates a signed pass for that customer.</li>
                <li>Your page gives that pass to the chat widget.</li>
              </ol>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className={cn(showAccountCode && "bg-muted")}
                onClick={() => setShowAccountCode((v) => !v)}
              >
                {showAccountCode ? "Hide code" : "Show code"}
              </Button>
              {showAccountCode ? (
                <div className="mt-2 space-y-2">
                  <CodeBlock
                    id="jwt"
                    text={jwtSnippet}
                    copied={copied}
                    onCopy={copySnippet}
                  />
                  <p className="text-xs text-muted-foreground">
                    On logout, call{" "}
                    <code className="text-[11px]">aideChat.clearUser()</code>.
                    Developer details:{" "}
                    <code className="text-[11px]">
                      docs/features/EMBED_END_USER_IDENTITY.md
                    </code>
                  </p>
                </div>
              ) : null}
            </FieldBlock>
          </div>
        </CollapsibleContent>
      </Collapsible>
    </FormSection>
  );
}
