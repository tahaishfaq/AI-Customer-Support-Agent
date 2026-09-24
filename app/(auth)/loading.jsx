import { AidePreloader } from "@/components/ui/aide-preloader";

/** Auth pages are simple — branded preloader only (no app chrome skeleton). */
export default function AuthLoading() {
  return <AidePreloader variant="page" label="Loading…" />;
}
