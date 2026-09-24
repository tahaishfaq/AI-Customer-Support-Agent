"use client";

import { X } from "lucide-react";
import { AideLogoMark } from "@/components/brand/AideLogo";
import { ShinyButton } from "@/components/ui/shiny-button";
import { launcherBox } from "@/lib/customization/launcher";

/**
 * Chat launcher: the original AIDE gleam launcher by default. Owners pick shape, size and ring
 * (gradient / solid / none, any color); the face shows the bot avatar, an uploaded icon
 * (white-label) or the AIDE mark, and cross-fades to ✕ while open.
 */
export function WidgetLauncher({ customization, open = false, onClick, buttonRef, style, preview = false, ...aria }) {
  const deploy = customization?.deploy || {};
  const identity = customization?.identity || {};
  const appearance = customization?.appearance || {};
  const dark = appearance.theme === "dark";
  const box = launcherBox(deploy);
  const src = deploy.useBotAvatar ? identity.avatarUrl : deploy.buttonImageUrl;
  const accent = deploy.launcherBorderColor || appearance.primaryColor || "var(--wc-primary)";

  return (
    <ShinyButton
      variant="launcher"
      buttonRef={buttonRef}
      accentColor={accent}
      fillColor="var(--wc-shell, #ffffff)"
      labelColor="var(--wc-shell-fg, #0f172a)"
      launcherWidth={box.width}
      launcherHeight={box.height}
      launcherRadius={box.radius}
      ring={deploy.launcherBorder || "gradient"}
      className="shadow-none outline-none"
      data-open={open ? "true" : "false"}
      style={style}
      onClick={onClick}
      tabIndex={preview ? -1 : undefined}
      aria-label={aria["aria-label"] || (open ? "Close chat widget" : "Open chat widget")}
      aria-expanded={preview ? undefined : open}
      aria-controls={preview ? undefined : "aide-chat-panel"}
    >
      <span className="aide-launcher-face" data-open={open ? "true" : "false"}>
        <span className="aide-launcher-layer aide-launcher-closed" aria-hidden={open}>
          {src ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={src} alt="" className="size-full object-cover" />
          ) : (
            <AideLogoMark
              variant={dark ? "light" : "dark"}
              size="sm"
              className={box.size === "lg" ? "h-5" : box.size === "sm" ? "h-3.5" : "h-4"}
              title="AIDE"
            />
          )}
        </span>
        <span className="aide-launcher-layer aide-launcher-open" aria-hidden={!open}>
          <X className="size-5" style={{ color: "var(--wc-shell-fg, #0f172a)" }} aria-hidden />
        </span>
      </span>
    </ShinyButton>
  );
}
