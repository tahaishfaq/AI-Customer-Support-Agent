"use client";

import Link from "next/link";
import { Fragment } from "react";
import { usePathname, useRouter } from "next/navigation";
import { LogOut, Menu, PanelLeft } from "lucide-react";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { useSidebar } from "@/components/ui/sidebar";
import { ThemeToggle } from "@/components/layout/ThemeToggle";
import { useAuthStore } from "@/store/auth-store";
import { useBreadcrumbStore } from "@/store/breadcrumb-store";
import { getBreadcrumbs } from "@/components/layout/nav";

function initials(name) {
  if (!name) return "A";
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");
}

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
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);
  const agentName = useBreadcrumbStore((s) => s.agentName);
  const crumbs = getBreadcrumbs(pathname, { agentName });

  async function handleLogout() {
    await logout();
    router.push("/");
    router.refresh();
  }

  return (
    <header className="z-30 flex h-12 shrink-0 items-center gap-2 border-b border-border bg-card/95 px-3 backdrop-blur-sm sm:px-5">
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

      <DropdownMenu>
        <DropdownMenuTrigger
          className="flex items-center gap-2 rounded-full outline-none focus-visible:ring-2 focus-visible:ring-ring/40"
          aria-label="Account menu"
        >
          <span className="hidden max-w-[9rem] truncate text-sm text-muted-foreground sm:block">
            {user?.name}
          </span>
          <Avatar size="sm">
            <AvatarFallback className="bg-primary text-[11px] font-semibold text-primary-foreground">
              {initials(user?.name)}
            </AvatarFallback>
          </Avatar>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="min-w-48">
          <DropdownMenuGroup>
            <DropdownMenuLabel className="font-normal">
              <p className="truncate text-sm font-medium">
                {user?.name || "Account"}
              </p>
              {user?.email ? (
                <p className="truncate text-xs text-muted-foreground">
                  {user.email}
                </p>
              ) : null}
            </DropdownMenuLabel>
          </DropdownMenuGroup>
          <DropdownMenuSeparator />
          <DropdownMenuGroup>
            <DropdownMenuItem
              variant="destructive"
              onClick={handleLogout}
              className="cursor-pointer"
            >
              <LogOut data-icon="inline-start" />
              Log out
            </DropdownMenuItem>
          </DropdownMenuGroup>
        </DropdownMenuContent>
      </DropdownMenu>
    </header>
  );
}
