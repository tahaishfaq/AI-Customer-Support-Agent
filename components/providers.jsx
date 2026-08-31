"use client";

import { ThemeProvider as NextThemesProvider } from "next-themes";
import { usePathname } from "next/navigation";
import { SessionProvider } from "@/components/session/SessionProvider";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";

function isLightOnlyRoute(pathname) {
  if (!pathname) return true;
  if (pathname === "/") return true;
  if (pathname.startsWith("/login")) return true;
  if (pathname.startsWith("/register")) return true;
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

  return (
    <NextThemesProvider
      attribute="class"
      defaultTheme="light"
      forcedTheme={lightOnly ? "light" : undefined}
      enableSystem={false}
      disableTransitionOnChange
      storageKey="hapy-theme"
    >
      <SessionProvider>
        <TooltipProvider>
          {children}
          <AppToaster />
        </TooltipProvider>
      </SessionProvider>
    </NextThemesProvider>
  );
}
