"use client";

import { usePathname } from "next/navigation";
import { AppSidebar } from "@/components/layout/AppSidebar";
import { AppTopbar } from "@/components/layout/AppTopbar";
import {
  SidebarInset,
  SidebarProvider,
} from "@/components/ui/sidebar";

/** Stable animation key — agent studio tab switches should not replay page-in. */
function routeAnimKey(pathname) {
  if (!pathname) return "";
  const parts = pathname.split("/").filter(Boolean);
  if (parts[0] === "agents" && parts[1] && parts[1] !== "new") {
    return `/agents/${parts[1]}`;
  }
  return pathname;
}

export function AppShell({ children }) {
  const pathname = usePathname();
  const animKey = routeAnimKey(pathname);

  return (
    <SidebarProvider className="h-dvh! min-h-0! overflow-hidden">
      <a
        href="#aide-main"
        className="sr-only focus:not-sr-only focus:absolute focus:top-3 focus:left-3 focus:z-[100] focus:rounded-lg focus:bg-primary focus:px-3 focus:py-2 focus:text-sm focus:font-medium focus:text-primary-foreground focus:shadow-md"
      >
        Skip to main content
      </a>
      <AppSidebar />
      <SidebarInset className="min-h-0 overflow-hidden">
        <AppTopbar />
        <div
          id="aide-main"
          key={animKey}
          tabIndex={-1}
          className="animate-page-in flex min-h-0 flex-1 flex-col overflow-hidden outline-none"
        >
          {children}
        </div>
      </SidebarInset>
    </SidebarProvider>
  );
}
