"use client";

import { usePathname } from "next/navigation";
import { SessionProvider } from "@/components/session/SessionProvider";
import { Toaster } from "@/components/ui/sonner";

function AppToaster() {
  const pathname = usePathname();
  if (pathname?.startsWith("/w/")) return null;
  return <Toaster />;
}

export function Providers({ children }) {
  return (
    <SessionProvider>
      {children}
      <AppToaster />
    </SessionProvider>
  );
}
