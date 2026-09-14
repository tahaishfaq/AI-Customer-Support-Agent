"use client";

import Link from "next/link";
import { Fragment } from "react";
import { usePathname } from "next/navigation";
import { Menu, PanelLeft } from "lucide-react";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { useSidebar } from "@/components/ui/sidebar";
import { ThemeToggle } from "@/components/layout/ThemeToggle";
import { useBreadcrumbStore } from "@/store/breadcrumb-store";
import { getBreadcrumbs } from "@/components/layout/nav";

function NavMenuTrigger() {
  const { toggleSidebar, isMobile, openMobile } = useSidebar();

  return (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      className="-ml-1 size-9 shrink-0 text-muted-foreground md:size-8"
      onClick={toggleSidebar}
      aria-label={isMobile && openMobile ? "Close menu" : "Open menu"}
      aria-expanded={isMobile ? openMobile : undefined}
      aria-controls={isMobile ? "aide-mobile-sidebar" : undefined}
    >
      <Menu className="size-5 md:hidden" />
      <PanelLeft className="hidden size-4 md:block" />
    </Button>
  );
}

export function AppTopbar() {
  const pathname = usePathname();
  const agentName = useBreadcrumbStore((s) => s.agentName);
  const crumbs = getBreadcrumbs(pathname, { agentName });

  return (
    <header className="z-30 flex h-12 shrink-0 items-center gap-1.5 border-b border-border bg-card/95 px-2 backdrop-blur-sm sm:gap-2 sm:px-4 md:px-5">
      <NavMenuTrigger />
      <Separator orientation="vertical" className="mr-1 hidden h-4 sm:block" />

      <Breadcrumb className="min-w-0 flex-1">
        <BreadcrumbList className="flex-nowrap">
          {crumbs.map((crumb, index) => {
            const last = index === crumbs.length - 1;
            return (
              <Fragment key={`${crumb.label}-${index}`}>
                {index > 0 ? <BreadcrumbSeparator /> : null}
                <BreadcrumbItem className="min-w-0">
                  {last || !crumb.href ? (
                    <BreadcrumbPage className="truncate font-medium">
                      {crumb.label}
                    </BreadcrumbPage>
                  ) : (
                    <BreadcrumbLink
                      render={<Link href={crumb.href} />}
                      className="truncate"
                    >
                      {crumb.label}
                    </BreadcrumbLink>
                  )}
                </BreadcrumbItem>
              </Fragment>
            );
          })}
        </BreadcrumbList>
      </Breadcrumb>

      <ThemeToggle className="text-muted-foreground" />
    </header>
  );
}
