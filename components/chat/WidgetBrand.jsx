import { cn } from "@/lib/utils";
import { AideLogoMark } from "@/components/brand/AideLogo";

export function WidgetBrand({ src, label = "AIDE", className, dark = false }) {
  if (src) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={src}
        alt={label}
        className={cn("size-9 shrink-0 rounded-full object-cover", className)}
      />
    );
  }

  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center justify-center rounded-full px-2.5 py-1",
        dark ? "bg-[#2a2a2a]" : "bg-[#f1f1ef]",
        className
      )}
    >
      <AideLogoMark
        variant={dark ? "light" : "dark"}
        size="sm"
        className="h-4"
        title="AIDE"
      />
    </span>
  );
}
