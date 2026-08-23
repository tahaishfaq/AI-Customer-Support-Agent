"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Inbox,
  LayoutDashboard,
  ScrollText,
  Shield,
  Users,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { getAdminOverview } from "@/lib/api/admin";
import { useAuthStore } from "@/store/auth-store";
import {
  ADMIN_NAV_GROUPS,
  isAdminNavActive,
} from "@/components/admin/admin-nav";

const ICONS = {
  dashboard: LayoutDashboard,
  users: Users,
  requests: Inbox,
  safety: Shield,
  audit: ScrollText,
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

function NavLink({ item, onNavigate, badge }) {
  const pathname = usePathname();
  const active = isAdminNavActive(pathname, item);
  const Icon = ICONS[item.icon];
  const showBadge = Number(badge) > 0;

  return (
    <Link
      href={item.href}
      onClick={onNavigate}
      className={cn(
        "flex items-center gap-2.5 rounded-md px-2.5 py-2 text-[13px] leading-snug",
        active
          ? "bg-[var(--sidebar-accent)] font-medium text-[var(--color-primary)]"
          : "font-normal text-[var(--color-text-secondary)] hover:bg-[var(--color-bg)] hover:text-[var(--color-text)]"
      )}
    >
      {Icon ? (
        <Icon
          className={cn(
            "size-4 shrink-0",
            active ? "text-[var(--color-primary)]" : "text-[var(--color-muted)]"
          )}
        />
      ) : null}
      <span className="min-w-0 flex-1 truncate">{item.label}</span>
      {showBadge ? (
        <span
          className="inline-flex min-w-5 shrink-0 items-center justify-center rounded-full bg-[var(--color-danger)] px-1.5 py-0.5 text-[10px] font-semibold tabular-nums text-white"
          aria-label={`${badge} pending`}
        >
          {badge > 99 ? "99+" : badge}
        </span>
      ) : null}
    </Link>
  );
}

export function AdminSidebar({ onNavigate }) {
  const user = useAuthStore((s) => s.user);
  const pathname = usePathname();
  const [pendingRestoreCount, setPendingRestoreCount] = useState(0);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const data = await getAdminOverview();
        if (!cancelled) {
          setPendingRestoreCount(Number(data?.pendingRestoreCount) || 0);
        }
      } catch {
        if (!cancelled) setPendingRestoreCount(0);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [pathname]);

  return (
    <div className="flex h-full min-h-0 flex-col bg-[var(--color-surface)]">
      <div className="flex h-[var(--app-topbar-height)] shrink-0 items-center gap-2 border-b border-[var(--color-border)] px-4">
        <Link
          href="/admin"
          onClick={onNavigate}
          className="min-w-0 truncate text-[14px] font-semibold tracking-tight text-[var(--color-primary)]"
        >
          Hapy
        </Link>
        <span className="rounded bg-[var(--color-primary)]/10 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-[var(--color-primary)]">
          Admin
        </span>
      </div>

      <nav className="min-h-0 flex-1 overflow-y-auto px-3 py-3">
        {ADMIN_NAV_GROUPS.map((group, index) => (
          <div key={group.id} className={cn(index > 0 && "mt-5")}>
            <p className="px-2.5 pb-1.5 text-[10px] font-semibold uppercase tracking-[0.08em] text-[var(--color-muted)]">
              {group.label}
            </p>
            <div className="flex flex-col gap-0.5">
              {group.items.map((item) => (
                <NavLink
                  key={item.href}
                  item={item}
                  onNavigate={onNavigate}
                  badge={
                    item.icon === "requests" ? pendingRestoreCount : undefined
                  }
                />
              ))}
            </div>
          </div>
        ))}
      </nav>

      <div className="shrink-0 border-t border-[var(--color-border)] px-3 py-3">
        <div className="flex min-w-0 items-center gap-2.5">
          <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-[var(--color-primary)]/10 text-[11px] font-semibold text-[var(--color-primary)]">
            {initials(user?.name)}
          </span>
          <span className="min-w-0">
            <span className="block truncate text-[13px] font-medium leading-tight text-[var(--color-text)]">
              {user?.name || "Admin"}
            </span>
            <span className="mt-0.5 block truncate text-[11px] leading-tight text-[var(--color-muted)]">
              {user?.email || "Operator"}
            </span>
          </span>
        </div>
      </div>
    </div>
  );
}
