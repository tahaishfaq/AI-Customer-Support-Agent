import { sizedCloudinaryUrl } from "@/lib/utils/cloudinary-url";
import { cn } from "@/lib/utils";

/**
 * Avatar &lt;img&gt; with explicit size + Cloudinary transform (F04-E).
 */
export function AvatarImage({
  src,
  alt = "",
  size = 40,
  className,
}) {
  if (!src) return null;
  const px = Math.max(16, Math.min(256, Math.round(size)));
  const href = sizedCloudinaryUrl(src, { width: px * 2, height: px * 2 });
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={href}
      alt={alt}
      width={px}
      height={px}
      loading="lazy"
      decoding="async"
      className={cn("object-cover", className)}
    />
  );
}
