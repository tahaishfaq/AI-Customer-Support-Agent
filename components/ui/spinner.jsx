import { Loader2Icon } from "lucide-react";
import { AideLoader } from "@/components/brand/AideLoader";
import { cn } from "@/lib/utils";

/**
 * Inline spinner. Pass brand for AIDE logo loader (panel waits / uploads).
 * Default stays a compact Lucide spin for button icons.
 */
function Spinner({ className, brand = false, ...props }) {
  if (brand) {
    return <AideLoader size="sm" className={className} {...props} />;
  }

  return (
    <Loader2Icon
      data-slot="spinner"
      role="status"
      aria-label="Loading"
      className={cn("size-4 animate-spin", className)}
      {...props}
    />
  );
}

export { Spinner };
