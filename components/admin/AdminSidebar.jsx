"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  CreditCard,
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
import { Badge } from "@/components/ui/badge";
import { AideLogo } from "@/components/brand/AideLogo";

const ICONS = {
  dashboard: LayoutDashboard,
  users: Users,
  requests: Inbox,
  billing: CreditCard,
  billingRequests: CreditCard,
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
          ? "bg-accent font-medium text-primary"
          : "font-normal text-muted-foreground hover:bg-muted hover:text-foreground"
      )}
    >
      {Icon ? (
        <Icon
          className={cn(
            "size-4 shrink-0",
            active ? "text-primary" : "text-muted-foreground"
          )}
        />
      ) : null}
      <span className="min-w-0 flex-1 truncate">{item.label}</span>
      {showBadge ? (
        <Badge
          variant="destructive"
          className="min-w-5 justify-center rounded-full px-1.5 py-0 text-[10px]"
          aria-label={`${badge} pending`}
        >
          {badge > 99 ? "99+" : badge}
        </Badge>
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
    <div className="flex h-full min-h-0 flex-col bg-card">
      <div className="flex h-[var(--app-topbar-height)] shrink-0 items-center gap-2 border-b border-border px-4">
        <Link
          href="/admin"
          onClick={onNavigate}
          className="inline-flex min-w-0 items-center text-primary"
          aria-label="AIDE admin"
        >
          <AideLogo size="sm" />
        </Link>
        <Badge variant="secondary" className="rounded-md text-[10px] uppercase">
          Admin
        </Badge>
      </div>

      <nav className="min-h-0 flex-1 overflow-y-auto px-3 py-3">
        {ADMIN_NAV_GROUPS.map((group, index) => (
          <div key={group.id} className={cn(index > 0 && "mt-5")}>
            <p className="px-2.5 pb-1.5 text-[10px] font-semibold tracking-[0.08em] text-muted-foreground uppercase">
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

      <div className="shrink-0 border-t border-border px-3 py-3">
        <div className="flex min-w-0 items-center gap-2.5">
          <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-[11px] font-semibold text-primary">
            {initials(user?.name)}
          </span>
          <span className="min-w-0">
            <span className="block truncate text-[13px] font-medium leading-tight text-foreground">
              {user?.name || "Admin"}
            </span>
            <span className="mt-0.5 block truncate text-[11px] leading-tight text-muted-foreground">
              {user?.email || "Operator"}
            </span>
          </span>
        </div>
      </div>
    </div>
  );
}
