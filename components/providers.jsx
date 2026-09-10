"use client";

import { usePathname } from "next/navigation";
import { ThemeProvider } from "@/components/theme/ThemeProvider";
import { SessionProvider } from "@/components/session/SessionProvider";
import { RealtimeProvider } from "@/components/realtime/RealtimeProvider";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryProvider } from "@/components/query/QueryProvider";

function isLightOnlyRoute(pathname) {
  if (!pathname) return true;
  if (pathname === "/") return true;
  if (pathname.startsWith("/login")) return true;
  if (pathname.startsWith("/register")) return true;
  if (pathname.startsWith("/forgot-password")) return true;
  if (pathname.startsWith("/reset-password")) return true;
  if (pathname.startsWith("/verify-email")) return true;
  if (pathname.startsWith("/w/")) return true;
  return false;
}

function AppToaster() {
  const pathname = usePathname();
  if (pathname?.startsWith("/w/")) return null;
  return <Toaster />;
}

export function Providers({ children }) {
  const pathname = usePathname();
  const lightOnly = isLightOnlyRoute(pathname);
  const isPublicEmbed = pathname?.startsWith("/w/");

  return (
    <ThemeProvider
      attribute="class"
      defaultTheme="light"
      forcedTheme={lightOnly ? "light" : undefined}
      enableSystem={false}
      storageKey="hapy-theme"
    >
      <SessionProvider>
        {isPublicEmbed ? (
          <RealtimeProvider>
            <TooltipProvider>{children}</TooltipProvider>
          </RealtimeProvider>
        ) : (
          <QueryProvider>
            <RealtimeProvider>
              <TooltipProvider>
                {children}
                <AppToaster />
              </TooltipProvider>
            </RealtimeProvider>
          </QueryProvider>
        )}
      </SessionProvider>
    </ThemeProvider>
  );
}
