"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BarChart3,
  Bot,
  ChevronUp,
  CreditCard,
  Headphones,
  Home,
  LogOut,
  Settings,
  Sparkles,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useConversationQuota } from "@/hooks/use-conversation-quota";
import { useDeskWaitingCount } from "@/hooks/use-desk-waiting-count";
import { WorkspaceSwitcher } from "@/components/layout/WorkspaceSwitcher";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  MONITOR_NAV,
  PRIMARY_NAV,
  isNavActive,
} from "@/components/layout/nav";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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
  useSidebar,
} from "@/components/ui/sidebar";
import { useAuthStore } from "@/store/auth-store";
import { cn } from "@/lib/utils";

const ICONS = {
  "/dashboard": Home,
  "/agents": Bot,
  "/inbox": Headphones,
  "/analytics": BarChart3,
};

function initials(name) {
  if (!name) return "A";
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");
}

function planDisplayName(billing, loading) {
  if (loading && !billing) return "Loading plan…";
  const plan = billing?.subscription?.plan;
  if (plan?.name) return plan.name;

  const slug = billing?.entitlements?.planSlug || billing?.planSlug;
  if (!slug) return "Basic";
  if (slug.toLowerCase() === "free") return "Basic";
  return slug
    .split(/[-_\s]+/)
    .map((part) => part[0]?.toUpperCase() + part.slice(1).toLowerCase())
    .join(" ");
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
  const deskWaiting = useDeskWaitingCount();
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);
  const { isMobile, setOpenMobile, state } = useSidebar();
  const collapsed = state === "collapsed" && !isMobile;
  const { billing, loading: billingLoading } = useConversationQuota({
    enabled: user?.role !== "ADMIN",
  });
  const currentPlan = planDisplayName(billing, billingLoading);

  async function handleLogout() {
    await logout();
    router.push("/");
    router.refresh();
  }

  function closeMobile() {
    if (isMobile) setOpenMobile(false);
  }

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

      <SidebarFooter className="mt-auto shrink-0 border-t border-sidebar-border px-2 pt-2 pb-3">
        <DropdownMenu>
          <DropdownMenuTrigger
            className={cn(
              "flex h-12 w-full min-w-0 items-center gap-2 rounded-lg px-3 text-left outline-none transition-[gap,padding,width] duration-300 ease-[var(--ease-ui)] focus-visible:ring-2 focus-visible:ring-sidebar-ring",
              !collapsed && "hover:bg-sidebar-accent",
              collapsed && "justify-center gap-0 px-0"
            )}
            aria-label="Open account menu"
          >
            <Avatar size="sm" className="shrink-0">
              <AvatarFallback className="bg-primary text-[11px] font-semibold text-primary-foreground">
                {initials(user?.name)}
              </AvatarFallback>
            </Avatar>
            <span
              className={cn(
                "min-w-0 flex-1 transition-[opacity,width] duration-200",
                collapsed && "pointer-events-none w-0 flex-none opacity-0"
              )}
            >
              <span className="block truncate text-sm font-medium text-sidebar-foreground">
                {user?.name || "Account"}
              </span>
              <span className="block truncate text-[11px] text-sidebar-foreground/60">
                {user?.email || "Manage account"}
              </span>
            </span>
            <ChevronUp
              className={cn(
                "size-4 shrink-0 text-sidebar-foreground/60 transition-opacity duration-200",
                collapsed && "w-0 opacity-0"
              )}
            />
          </DropdownMenuTrigger>
          <DropdownMenuContent
            side={isMobile ? "bottom" : "right"}
            align="end"
            sideOffset={isMobile ? 4 : 8}
            className="w-60 min-w-60"
          >
            <DropdownMenuLabel className="px-2 py-2 font-normal">
              <p className="truncate text-sm font-medium">
                {user?.name || "Account"}
              </p>
              {user?.email ? (
                <p className="truncate text-xs text-muted-foreground">
                  {user.email}
                </p>
              ) : null}
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <div className="mx-1 rounded-md border border-border/70 bg-muted/30 px-2.5 py-2">
              <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                Current plan
              </p>
              <p className="mt-0.5 truncate text-sm font-semibold text-foreground">
                {currentPlan}
              </p>
            </div>
            <DropdownMenuGroup>
              <DropdownMenuItem
                className="mt-1 cursor-pointer"
                onClick={() => {
                  closeMobile();
                  router.push("/billing/plans");
                }}
              >
                <Sparkles data-icon="inline-start" />
                Upgrade plan
              </DropdownMenuItem>
              <DropdownMenuItem
                className="cursor-pointer"
                onClick={() => {
                  closeMobile();
                  router.push("/settings");
                }}
              >
                <Settings data-icon="inline-start" />
                Settings
              </DropdownMenuItem>
              <DropdownMenuItem
                className="cursor-pointer"
                onClick={() => {
                  closeMobile();
                  router.push("/settings/billing");
                }}
              >
                <CreditCard data-icon="inline-start" />
                Billing
              </DropdownMenuItem>
            </DropdownMenuGroup>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              variant="destructive"
              onClick={handleLogout}
              className="cursor-pointer"
            >
              <LogOut data-icon="inline-start" />
              Log out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarFooter>
    </Sidebar>
  );
}
