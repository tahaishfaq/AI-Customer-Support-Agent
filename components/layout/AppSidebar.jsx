"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BarChart3,
  Bot,
  Headphones,
  Home,
  MessageSquare,
  MessagesSquare,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuthStore } from "@/store/auth-store";
import { useDeskWaitingCount } from "@/hooks/use-desk-waiting-count";
import { WorkspaceSwitcher } from "@/components/layout/WorkspaceSwitcher";
import {
  MONITOR_NAV,
  PRIMARY_NAV,
  isNavActive,
} from "@/components/layout/nav";

const ICONS = {
  "/dashboard": Home,
  "/agents": Bot,
  "/chat": MessageSquare,
  "/conversations": MessagesSquare,
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

function NavLink({ item, onNavigate, badge }) {
  const pathname = usePathname();
  const active = isNavActive(pathname, item.href);
  const Icon = ICONS[item.href];
  const showBadge = badge > 0 && item.href === "/inbox";

  return (
    <Link
      href={item.href}
      onClick={onNavigate}
      className={cn(
        "relative flex items-center gap-2.5 rounded-md px-2.5 py-2 text-[13px] transition-colors",
        active
          ? "bg-[var(--sidebar-accent)] font-medium text-[var(--color-primary)]"
          : "font-normal text-[var(--color-text-secondary)] hover:bg-[var(--color-bg)] hover:text-[var(--color-text)]"
      )}
    >
      {active ? (
        <span
          aria-hidden
          className="absolute inset-y-1.5 left-0 w-[2px] rounded-full bg-[var(--color-primary)]"
        />
      ) : null}
      {Icon ? (
        <Icon
          className={cn(
            "size-[16px] shrink-0",
            active ? "text-[var(--color-primary)]" : "text-[var(--color-muted)]"
          )}
        />
      ) : null}
      <span className="min-w-0 flex-1 truncate">{item.label}</span>
      {showBadge ? (
        <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-[var(--color-warning)] text-[10px] font-semibold text-white">
          {badge > 9 ? "9+" : badge}
        </span>
      ) : null}
    </Link>
  );
}

export function AppSidebar({ onNavigate }) {
  const user = useAuthStore((s) => s.user);
  const deskWaiting = useDeskWaitingCount();

  return (
    <div className="flex h-full flex-col bg-[var(--color-surface)]">
      <div className="flex h-[var(--app-topbar-height)] items-center border-b border-[var(--color-border)] px-3.5">
        <WorkspaceSwitcher />
      </div>

      <nav className="flex-1 space-y-4 overflow-y-auto px-2.5 py-3">
        <div className="space-y-px">
          {PRIMARY_NAV.map((item) => (
            <NavLink key={item.href} item={item} onNavigate={onNavigate} />
          ))}
        </div>

        <div>
          <p className="mb-1 px-2.5 text-[10px] font-semibold uppercase tracking-[0.08em] text-[var(--color-muted)]">
            Monitor
          </p>
          <div className="space-y-px">
            {MONITOR_NAV.map((item) => (
              <NavLink
                key={item.href}
                item={item}
                onNavigate={onNavigate}
                badge={item.href === "/inbox" ? deskWaiting : 0}
              />
            ))}
          </div>
        </div>
      </nav>

      <div className="border-t border-[var(--color-border)] px-3 py-2.5">
        <div className="flex items-center gap-2.5 rounded-md px-1 py-1">
          <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-[var(--color-primary)]/10 text-[10px] font-semibold text-[var(--color-primary)]">
            {initials(user?.name)}
          </span>
          <span className="min-w-0">
            <span className="block truncate text-[13px] font-medium leading-tight text-[var(--color-text)]">
              {user?.name || "Account"}
            </span>
            <span className="block truncate text-[11px] leading-tight text-[var(--color-muted)]">
              {user?.email || "Signed in"}
            </span>
          </span>
        </div>
      </div>
    </div>
  );
}
