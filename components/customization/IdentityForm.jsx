"use client";

import { useRef, useState } from "react";
import { ImagePlus, Loader2, X } from "lucide-react";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { uploadAgentAvatar } from "@/lib/api/agents";
import {
  FieldBlock,
  FormSection,
  MiniLabel,
  areaClass,
  fieldClass,
} from "@/components/customization/CustomizationFields";

function monogram(name) {
  if (!name) return "A";
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase())
    .join("");
}

export function IdentityForm({ agentId, identity, onChange }) {
  const fileRef = useRef(null);
  const [uploading, setUploading] = useState(false);

  function patch(partial) {
    onChange({ ...identity, ...partial });
  }

  async function handleAvatar(file) {
    if (!file) return;
    setUploading(true);
    try {
      const data = await uploadAgentAvatar(agentId, file);
      patch({ avatarUrl: data.avatarUrl });
      toast.success("Avatar uploaded");
    } catch (err) {
      toast.error(err.message || "Unable to upload avatar");
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  return (
    <div className="space-y-6">
      <FormSection title="Profile">
        <FieldBlock
          label="Agent profile"
          hint="Avatar and name shown in the chat header and welcome screen."
        >
          <div className="flex items-start gap-3">
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              disabled={uploading}
              className="relative flex size-[72px] shrink-0 items-center justify-center overflow-hidden rounded-xl border border-[var(--color-border)] bg-white shadow-sm"
            >
              {identity.avatarUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={identity.avatarUrl}
                  alt=""
                  className="size-full object-cover"
                />
              ) : (
                <span className="text-base font-semibold text-[var(--color-primary)]">
                  {monogram(identity.displayName)}
                </span>
              )}
              {uploading ? (
                <span className="absolute inset-0 flex items-center justify-center bg-white/70">
                  <Loader2 className="size-4 animate-spin text-[var(--color-primary)]" />
                </span>
              ) : (
                <span className="absolute right-1 bottom-1 rounded-md bg-white/95 p-0.5 shadow-sm">
                  <ImagePlus className="size-3 text-[var(--color-muted)]" />
                </span>
              )}
            </button>
            <div className="min-w-0 flex-1 space-y-2">
              <MiniLabel>Display name</MiniLabel>
              <Input
                value={identity.displayName}
                onChange={(e) => patch({ displayName: e.target.value })}
                placeholder="My bot agent"
                className={fieldClass}
              />
              <div className="flex flex-wrap gap-3 pt-0.5">
                <button
                  type="button"
                  onClick={() => fileRef.current?.click()}
                  disabled={uploading}
                  className="text-[12px] font-medium text-[var(--color-primary)] hover:underline"
                >
                  Upload image
                </button>
                {identity.avatarUrl ? (
                  <button
                    type="button"
                    onClick={() => patch({ avatarUrl: null })}
                    className="inline-flex items-center gap-1 text-[12px] text-[var(--color-muted)] hover:text-[var(--color-danger)]"
                  >
                    <X className="size-3" />
                    Remove
                  </button>
                ) : null}
              </div>
            </div>
            <input
              ref={fileRef}
              type="file"
              accept="image/png,image/jpeg,image/webp,image/gif"
              className="hidden"
              onChange={(e) => handleAvatar(e.target.files?.[0])}
            />
          </div>
          <div className="mt-4">
            <MiniLabel>Description</MiniLabel>
            <Textarea
              value={identity.description}
              onChange={(e) => patch({ description: e.target.value })}
              placeholder="Describe what your bot does"
              rows={3}
              className={areaClass}
            />
          </div>
        </FieldBlock>
      </FormSection>

      <FormSection title="Composer">
        <FieldBlock
          label="Input copy"
          hint="Placeholder and footer under the message box."
        >
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <MiniLabel>Message placeholder</MiniLabel>
              <Input
                value={identity.messagePlaceholder}
                onChange={(e) => patch({ messagePlaceholder: e.target.value })}
                placeholder="Type your message..."
                className={fieldClass}
              />
            </div>
            <div>
              <MiniLabel>Footer</MiniLabel>
              <Input
                value={identity.footer}
                onChange={(e) => patch({ footer: e.target.value })}
                placeholder="by Hapy"
                className={fieldClass}
              />
            </div>
          </div>
        </FieldBlock>
      </FormSection>

      <FormSection title="Contact">
        <FieldBlock
          label="Contact details"
          hint="Shown in the widget about/info area."
        >
          <div className="grid gap-3 sm:grid-cols-3">
            <div>
              <MiniLabel>Email</MiniLabel>
              <Input
                type="email"
                value={identity.contactEmail}
                onChange={(e) => patch({ contactEmail: e.target.value })}
                placeholder="support@…"
                className={fieldClass}
              />
            </div>
            <div>
              <MiniLabel>Phone</MiniLabel>
              <Input
                value={identity.contactPhone}
                onChange={(e) => patch({ contactPhone: e.target.value })}
                placeholder="+1…"
                className={fieldClass}
              />
            </div>
            <div>
              <MiniLabel>Website</MiniLabel>
              <Input
                value={identity.contactWebsite}
                onChange={(e) => patch({ contactWebsite: e.target.value })}
                placeholder="https://"
                className={fieldClass}
              />
            </div>
          </div>
        </FieldBlock>
      </FormSection>

      <FormSection title="Legal">
        <FieldBlock label="Policy links">
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <MiniLabel>Terms of service</MiniLabel>
              <Input
                value={identity.termsUrl}
                onChange={(e) => patch({ termsUrl: e.target.value })}
                placeholder="https://"
                className={fieldClass}
              />
            </div>
            <div>
              <MiniLabel>Privacy policy</MiniLabel>
              <Input
                value={identity.privacyUrl}
                onChange={(e) => patch({ privacyUrl: e.target.value })}
                placeholder="https://"
                className={fieldClass}
              />
            </div>
          </div>
        </FieldBlock>
      </FormSection>
    </div>
  );
}
