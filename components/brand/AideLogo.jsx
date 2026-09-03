import Image from "next/image";
import Link from "next/link";
import { cn } from "@/lib/utils";

const LOGO = {
  dark: {
    src: "/brand/aide-logo.png",
    width: 710,
    height: 240,
  },
  light: {
    src: "/brand/aide-logo-white.png",
    width: 710,
    height: 240,
  },
};

const SIZE_CLASS = {
  sm: "h-5 w-auto",
  md: "h-6 w-auto sm:h-7",
  lg: "h-8 w-auto sm:h-9",
};

/**
 * Exact AIDE wordmark from brand PNG (gloss horizontal band).
 * - variant="dark" → black ink (light backgrounds)
 * - variant="light" → white ink (dark backgrounds)
 * - variant="auto" → swaps with dark mode
 */
export function AideLogoMark({
  className,
  title = "AIDE",
  variant = "auto",
  size = "md",
  priority = false,
}) {
  const sizeClass = SIZE_CLASS[size] || SIZE_CLASS.md;
  const imgClass = cn(
    "block w-auto select-none object-contain object-left",
    sizeClass,
    className
  );

  if (variant === "dark" || variant === "light") {
    const asset = LOGO[variant];
    return (
      <Image
        src={asset.src}
        alt={title}
        width={asset.width}
        height={asset.height}
        priority={priority}
        className={imgClass}
      />
    );
  }

  return (
    <span className="inline-flex items-center">
      <Image
        src={LOGO.dark.src}
        alt={title}
        width={LOGO.dark.width}
        height={LOGO.dark.height}
        priority={priority}
        className={cn(imgClass, "dark:hidden")}
      />
      <Image
        src={LOGO.light.src}
        alt=""
        aria-hidden
        width={LOGO.light.width}
        height={LOGO.light.height}
        priority={priority}
        className={cn(imgClass, "hidden dark:block")}
      />
    </span>
  );
}

export function AideLogo({
  href,
  className,
  markClassName,
  size = "md",
  variant = "auto",
  priority = false,
}) {
  const mark = (
    <AideLogoMark
      className={markClassName}
      size={size}
      variant={variant}
      priority={priority}
    />
  );

  if (href) {
    return (
      <Link
        href={href}
        className={cn(
          "inline-flex items-center transition-opacity hover:opacity-80",
          className
        )}
        aria-label="AIDE home"
      >
        {mark}
      </Link>
    );
  }

  return (
    <span className={cn("inline-flex items-center", className)}>{mark}</span>
  );
}

/** CSS text fallback when an image mark is unnecessary. */
export function AideLogoText({ className, as: Tag = "span" }) {
  return (
    <Tag
      className={cn(
        "font-[family-name:var(--font-dm-sans)] text-[1.15rem] font-black tracking-[-0.03em] text-foreground uppercase",
        className
      )}
    >
      AIDE
    </Tag>
  );
}
