"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BarChart3,
  Bot,
  CreditCard,
  Headphones,
  Home,
  MessageSquare,
} from "lucide-react";
import { useDeskWaitingCount } from "@/hooks/use-desk-waiting-count";
import { ConversationQuotaSidebar } from "@/components/billing/ConversationQuotaShell";
import { WorkspaceSwitcher } from "@/components/layout/WorkspaceSwitcher";
import {
  MONITOR_NAV,
  PRIMARY_NAV,
  ACCOUNT_NAV,
  isNavActive,
} from "@/components/layout/nav";
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
  "/billing/plans": CreditCard,
  "/settings/billing": CreditCard,
};

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

        <SidebarGroup>
          <SidebarGroupLabel>Account</SidebarGroupLabel>
          <SidebarGroupContent>
            <NavItems items={ACCOUNT_NAV} />
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="mt-auto shrink-0 border-t border-sidebar-border px-2 pt-2 pb-3">
        <ConversationQuotaSidebar />
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  );
}
