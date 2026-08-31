"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { ChevronRight, LogOut, Menu } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/layout/ThemeToggle";
import { useAuthStore } from "@/store/auth-store";
import { ADMIN_NAV, isAdminNavActive } from "@/components/admin/admin-nav";

function adminCrumb(pathname) {
  const current =
    ADMIN_NAV.find((item) => isAdminNavActive(pathname, item)) || ADMIN_NAV[0];
  if (pathname.startsWith("/admin/users/") && pathname.includes("/agents/")) {
    return "Agent inspect";
  }
  if (
    pathname.startsWith("/admin/users/") &&
    pathname.includes("/workspaces/")
  ) {
    return "Workspace";
  }
  if (/^\/admin\/users\/[^/]+$/.test(pathname)) {
    return "User";
  }
  return current.label;
}

export function AdminTopbar({ onMenuClick }) {
  const pathname = usePathname();
  const router = useRouter();
  const logout = useAuthStore((s) => s.logout);
  const label = adminCrumb(pathname);

  async function handleLogout() {
    await logout();
    router.push("/login");
    router.refresh();
  }

  return (
    <header className="z-30 flex h-[var(--app-topbar-height)] shrink-0 items-center justify-between gap-3 border-b border-border bg-card/95 px-3 backdrop-blur-sm sm:px-5">
      <div className="flex min-w-0 items-center gap-1">
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="size-8 shrink-0 md:hidden"
          onClick={onMenuClick}
          aria-label="Open menu"
        >
          <Menu className="size-4" />
        </Button>
        <nav
          aria-label="Breadcrumb"
          className="flex min-w-0 items-center text-[13px]"
        >
          <Link
            href="/admin"
            className="shrink-0 rounded-sm text-muted-foreground outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/40"
          >
            Admin
          </Link>
          <ChevronRight
            className="mx-1 size-3.5 shrink-0 text-muted-foreground"
            aria-hidden
          />
          <span className="truncate font-medium text-foreground">{label}</span>
        </nav>
      </div>
      <div className="flex items-center gap-1">
        <ThemeToggle className="text-muted-foreground" />
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="gap-1.5 text-muted-foreground"
          onClick={handleLogout}
        >
          <LogOut className="size-3.5" />
          Sign out
        </Button>
      </div>
    </header>
  );
}
