"use client";

import { useRef, useState } from "react";
import { ImagePlus, X } from "lucide-react";
import { toast } from "sonner";
import { AvatarImage } from "@/components/ui/avatar-image";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import { Textarea } from "@/components/ui/textarea";
import { uploadAgentAvatar } from "@/lib/api/agents";
import {
  FieldBlock,
  FormSection,
  MiniLabel,
  areaClass,
  fieldClass,
} from "@/components/customization/CustomizationFields";
import { monogram } from "@/components/conversations/format";
import { ImageUploadField, PlanLock } from "@/components/customization/WhiteLabelFields";

const AVATAR_MAX_BYTES = 2 * 1024 * 1024;

export function IdentityForm({ agentId, identity, onChange, whiteLabelAllowed = false }) {
  const fileRef = useRef(null);
  const [uploading, setUploading] = useState(false);

  function patch(partial) {
    onChange({ ...identity, ...partial });
  }

  async function handleAvatar(file) {
    if (!file) return;
    if (file.size > AVATAR_MAX_BYTES) {
      toast.error("Image must be 2MB or smaller");
      return;
    }
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
              className="relative flex size-[72px] shrink-0 items-center justify-center overflow-hidden rounded-xl border border-border bg-card shadow-sm"
            >
              {identity.avatarUrl ? (
                <AvatarImage
                  src={identity.avatarUrl}
                  size={72}
                  className="size-full"
                />
              ) : (
                <span className="text-base font-semibold text-primary">
                  {monogram(identity.displayName)}
                </span>
              )}
              {uploading ? (
                <span className="absolute inset-0 flex items-center justify-center bg-card/80">
                  <Spinner />
                </span>
              ) : (
                <span className="absolute right-1 bottom-1 rounded-md bg-card/95 p-0.5 shadow-sm">
                  <ImagePlus className="size-3 text-muted-foreground" />
                </span>
              )}
            </button>
            <div className="min-w-0 flex-1 space-y-2">
              <MiniLabel htmlFor="identity-display-name">Display name</MiniLabel>
              <Input
                id="identity-display-name"
                value={identity.displayName}
                onChange={(e) => patch({ displayName: e.target.value })}
                placeholder="My bot agent"
                className={fieldClass}
              />
              <div className="flex flex-wrap gap-2 pt-0.5">
                <Button
                  type="button"
                  variant="link"
                  size="sm"
                  className="h-auto px-0"
                  onClick={() => fileRef.current?.click()}
                  disabled={uploading}
                >
                  Upload image (max 2MB)
                </Button>
                {identity.avatarUrl ? (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-auto gap-1 px-0 text-muted-foreground hover:text-destructive"
                    onClick={() => patch({ avatarUrl: null })}
                  >
                    <X className="size-3" />
                    Remove
                  </Button>
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
            <MiniLabel htmlFor="identity-description">Description</MiniLabel>
            <Textarea
              id="identity-description"
              value={identity.description}
              onChange={(e) => patch({ description: e.target.value })}
              placeholder="Describe what your bot does"
              rows={3}
              className={areaClass}
            />
          </div>
        </FieldBlock>
      </FormSection>

      <FormSection title="Messenger">
        <FieldBlock
          label={<span className="inline-flex items-center gap-2">Company logo <PlanLock allowed={whiteLabelAllowed} /></span>}
          hint="Shown at the top of Home and in the chat header, beside the avatars."
        >
          <ImageUploadField
            agentId={agentId}
            label="company logo"
            value={identity.logoUrl}
            onChange={(logoUrl) => patch({ logoUrl })}
            locked={!whiteLabelAllowed}
          />
        </FieldBlock>
        <FieldBlock label="Team avatars" hint="Up to 3 faces stacked next to the agent avatar, like a real support team.">
          <div className="flex flex-col gap-3">
            {[0, 1, 2].map((index) => (
              <ImageUploadField
                key={index}
                agentId={agentId}
                label={`team avatar ${index + 1}`}
                shape="circle"
                value={(identity.teamAvatars || [])[index] || null}
                onChange={(url) => {
                  const next = [...(identity.teamAvatars || [])];
                  if (url) next[index] = url;
                  else next.splice(index, 1);
                  patch({ teamAvatars: next.filter(Boolean).slice(0, 3) });
                }}
              />
            )).slice(0, Math.min(3, (identity.teamAvatars || []).length + 1))}
          </div>
        </FieldBlock>
        <FieldBlock label="Home greeting" hint="Two lines at the top of the Home screen.">
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <MiniLabel htmlFor="identity-greeting-title">First line</MiniLabel>
              <Input
                id="identity-greeting-title"
                value={identity.greetingTitle}
                maxLength={60}
                onChange={(e) => patch({ greetingTitle: e.target.value })}
                placeholder="Hi there 👋"
                className={fieldClass}
              />
            </div>
            <div>
              <MiniLabel htmlFor="identity-greeting-subtitle">Second line</MiniLabel>
              <Input
                id="identity-greeting-subtitle"
                value={identity.greetingSubtitle}
                maxLength={80}
                onChange={(e) => patch({ greetingSubtitle: e.target.value })}
                placeholder="How can we help?"
                className={fieldClass}
              />
            </div>
          </div>
          <div className="mt-3">
            <MiniLabel htmlFor="identity-conversation-intro">Conversation intro</MiniLabel>
            <Input
              id="identity-conversation-intro"
              value={identity.conversationIntro}
              maxLength={160}
              onChange={(e) => patch({ conversationIntro: e.target.value })}
              placeholder="Ask us anything, or share your feedback."
              className={fieldClass}
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
              <MiniLabel htmlFor="identity-placeholder">
                Message placeholder
              </MiniLabel>
              <Input
                id="identity-placeholder"
                value={identity.messagePlaceholder}
                onChange={(e) => patch({ messagePlaceholder: e.target.value })}
                placeholder="Type your message..."
                className={fieldClass}
              />
            </div>
            <div>
              <MiniLabel htmlFor="identity-footer">
                <span className="inline-flex items-center gap-2">Footer <PlanLock allowed={whiteLabelAllowed} /></span>
              </MiniLabel>
              <Input
                id="identity-footer"
                value={identity.footer}
                onChange={(e) => patch({ footer: e.target.value })}
                placeholder="by AIDE"
                disabled={!whiteLabelAllowed}
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
              <MiniLabel htmlFor="identity-email">Email</MiniLabel>
              <Input
                id="identity-email"
                type="email"
                value={identity.contactEmail}
                onChange={(e) => patch({ contactEmail: e.target.value })}
                placeholder="support@…"
                className={fieldClass}
              />
            </div>
            <div>
              <MiniLabel htmlFor="identity-phone">Phone</MiniLabel>
              <Input
                id="identity-phone"
                value={identity.contactPhone}
                onChange={(e) => patch({ contactPhone: e.target.value })}
                placeholder="+1…"
                className={fieldClass}
              />
            </div>
            <div>
              <MiniLabel htmlFor="identity-website">Website</MiniLabel>
              <Input
                id="identity-website"
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
              <MiniLabel htmlFor="identity-terms">Terms of service</MiniLabel>
              <Input
                id="identity-terms"
                value={identity.termsUrl}
                onChange={(e) => patch({ termsUrl: e.target.value })}
                placeholder="https://"
                className={fieldClass}
              />
            </div>
            <div>
              <MiniLabel htmlFor="identity-privacy">Privacy policy</MiniLabel>
              <Input
                id="identity-privacy"
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
