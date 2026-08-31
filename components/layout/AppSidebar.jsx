"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BarChart3,
  Bot,
  Headphones,
  Home,
  MessageSquare,
} from "lucide-react";
import { useAuthStore } from "@/store/auth-store";
import { useDeskWaitingCount } from "@/hooks/use-desk-waiting-count";
import { WorkspaceSwitcher } from "@/components/layout/WorkspaceSwitcher";
import {
  MONITOR_NAV,
  PRIMARY_NAV,
  isNavActive,
} from "@/components/layout/nav";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuBadge,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
  useSidebar,
} from "@/components/ui/sidebar";

const ICONS = {
  "/dashboard": Home,
  "/agents": Bot,
  "/chat": MessageSquare,
  "/inbox": Headphones,
  "/analytics": BarChart3,
};

function initials(name) {
  if (!name) return "H";
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");
}

function NavItems({ items, badgeForHref }) {
  const pathname = usePathname();
  const { isMobile, setOpenMobile } = useSidebar();

  return (
    <SidebarMenu>
      {items.map((item) => {
        const Icon = ICONS[item.href];
        const active = isNavActive(pathname, item.href);
        const badge = badgeForHref?.(item.href) ?? 0;

        return (
          <SidebarMenuItem key={item.href}>
            <SidebarMenuButton
              render={<Link href={item.href} />}
              isActive={active}
              tooltip={item.label}
              onClick={() => {
                if (isMobile) setOpenMobile(false);
              }}
            >
              {Icon ? <Icon /> : null}
              <span>{item.label}</span>
            </SidebarMenuButton>
            {badge > 0 ? (
              <SidebarMenuBadge className="rounded-full bg-primary text-[10px] font-semibold text-primary-foreground">
                {badge > 9 ? "9+" : badge}
              </SidebarMenuBadge>
            ) : null}
          </SidebarMenuItem>
        );
      })}
    </SidebarMenu>
  );
}

export function AppSidebar() {
  const user = useAuthStore((s) => s.user);
  const deskWaiting = useDeskWaitingCount();

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader className="border-b border-sidebar-border">
        <SidebarMenu>
          <SidebarMenuItem>
            <WorkspaceSwitcher />
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupContent>
            <NavItems items={PRIMARY_NAV} />
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarGroup>
          <SidebarGroupLabel>Monitor</SidebarGroupLabel>
          <SidebarGroupContent>
            <NavItems
              items={MONITOR_NAV}
              badgeForHref={(href) =>
                href === "/inbox" ? deskWaiting : 0
              }
            />
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="border-t border-sidebar-border">
        <div className="flex items-center gap-2.5 overflow-hidden px-1 py-0.5 transition-[gap,padding] duration-300 ease-[var(--ease-ui)] motion-reduce:transition-none group-data-[collapsible=icon]:justify-start group-data-[collapsible=icon]:gap-0 group-data-[collapsible=icon]:px-0">
          <Avatar size="sm" className="shrink-0">
            <AvatarFallback className="bg-primary/10 text-[10px] font-semibold text-primary">
              {initials(user?.name)}
            </AvatarFallback>
          </Avatar>
          <div className="min-w-0 flex-1 overflow-hidden opacity-100 transition-[opacity,width,flex-basis] duration-300 ease-[var(--ease-ui)] motion-reduce:transition-none group-data-[collapsible=icon]:pointer-events-none group-data-[collapsible=icon]:w-0 group-data-[collapsible=icon]:flex-none group-data-[collapsible=icon]:opacity-0">
            <p className="truncate text-sm font-medium leading-tight">
              {user?.name || "Account"}
            </p>
            <p className="truncate text-[11px] leading-tight text-muted-foreground">
              {user?.email || "Signed in"}
            </p>
          </div>
        </div>
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  );
}
