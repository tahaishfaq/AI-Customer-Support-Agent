"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { ChevronRight, LogOut, Menu } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useAuthStore } from "@/store/auth-store";
import { useBreadcrumbStore } from "@/store/breadcrumb-store";
import { getBreadcrumbs } from "@/components/layout/nav";

function initials(name) {
  if (!name) return "H";
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");
}

export function AppTopbar({ onMenuClick }) {
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
    <header className="z-30 flex h-[var(--app-topbar-height)] shrink-0 items-center justify-between gap-3 border-b border-[var(--color-border)] bg-[var(--color-surface)]/95 px-3 shadow-[var(--shadow-bar)] backdrop-blur-sm sm:px-5">
      <div className="flex min-w-0 items-center gap-1">
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="size-8 shrink-0 text-[var(--color-text-secondary)] md:hidden"
          onClick={onMenuClick}
          aria-label="Open menu"
        >
          <Menu className="size-4" />
        </Button>

        <nav
          aria-label="Breadcrumb"
          className="flex min-w-0 items-center text-[13px]"
        >
          {crumbs.map((crumb, index) => {
            const last = index === crumbs.length - 1;
            return (
              <span
                key={`${crumb.label}-${index}`}
                className="flex min-w-0 items-center"
              >
                {index > 0 ? (
                  <ChevronRight
                    className="mx-1 size-3.5 shrink-0 text-[var(--color-muted)]"
                    aria-hidden
                  />
                ) : null}
                {last || !crumb.href ? (
                  <span className="truncate font-medium text-[var(--color-text)]">
                    {crumb.label}
                  </span>
                ) : (
                  <Link
                    href={crumb.href}
                    className="truncate text-[var(--color-muted)] hover:text-[var(--color-text)]"
                  >
                    {crumb.label}
                  </Link>
                )}
              </span>
            );
          })}
        </nav>
      </div>

      <DropdownMenu>
        <DropdownMenuTrigger
          className="flex items-center gap-2 rounded-full outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary)]/30"
          aria-label="Account menu"
        >
          <span className="hidden max-w-[9rem] truncate text-[13px] text-[var(--color-text-secondary)] sm:block">
            {user?.name}
          </span>
          <span className="flex size-8 items-center justify-center rounded-full bg-[var(--color-primary)] text-[11px] font-semibold text-white">
            {initials(user?.name)}
          </span>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="min-w-48">
          <DropdownMenuLabel className="font-normal">
            <p className="truncate text-sm font-medium text-[var(--color-text)]">
              {user?.name || "Account"}
            </p>
            {user?.email ? (
              <p className="truncate text-xs text-[var(--color-muted)]">
                {user.email}
              </p>
            ) : null}
          </DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            variant="destructive"
            onClick={handleLogout}
            className="cursor-pointer"
          >
            <LogOut />
            Log out
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </header>
  );
}
