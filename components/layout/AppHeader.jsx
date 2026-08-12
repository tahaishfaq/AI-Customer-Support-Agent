"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useAuthStore } from "@/store/auth-store";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const NAV = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/agents", label: "Agents" },
  { href: "/chat", label: "Chat" },
  { href: "/conversations", label: "Conversations" },
  { href: "/analytics", label: "Analytics" },
];

function initials(name) {
  if (!name) return "H";
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");
}

function NavLinks({ className, itemClassName }) {
  const pathname = usePathname();

  return (
    <nav className={className}>
      {NAV.map((item) => {
        const active =
          pathname === item.href || pathname.startsWith(`${item.href}/`);
        return (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              "relative rounded-full px-3.5 py-1.5 text-sm font-medium transition-colors",
              active
                ? "bg-[var(--color-primary)] text-white shadow-sm"
                : "text-[var(--color-text-secondary)] hover:bg-[var(--color-bg)] hover:text-[var(--color-text)]",
              itemClassName
            )}
          >
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}

export function AppHeader() {
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const loading = useAuthStore((s) => s.loading);
  const logout = useAuthStore((s) => s.logout);

  async function handleLogout() {
    await logout();
    router.push("/");
    router.refresh();
  }

  return (
    <header className="sticky top-0 z-40 border-b border-[var(--color-border)]/80 bg-[var(--color-surface)]/90 backdrop-blur-md">
      <div className="mx-auto grid w-full max-w-6xl grid-cols-[1fr_auto_1fr] items-center gap-4 px-6 py-3.5">
        <div className="justify-self-start">
          <Link
            href="/dashboard"
            className="font-[family-name:var(--font-display)] text-lg font-semibold text-[var(--color-primary)]"
          >
            Hapy
          </Link>
        </div>

        <NavLinks className="hidden items-center justify-center gap-1 md:flex" />

        <div className="flex items-center justify-end gap-3 justify-self-end">
          {!loading && user ? (
            <div className="hidden items-center gap-2.5 sm:flex">
              <span className="flex size-8 items-center justify-center rounded-full bg-[var(--color-primary)]/10 text-xs font-semibold text-[var(--color-primary)]">
                {initials(user.name)}
              </span>
              <span className="max-w-[10rem] truncate text-sm font-medium text-[var(--color-text)]">
                {user.name}
              </span>
            </div>
          ) : null}
          <Button variant="outline" size="sm" onClick={handleLogout}>
            Log out
          </Button>
        </div>
      </div>

      <NavLinks
        className="flex justify-center gap-1 overflow-x-auto px-4 pb-3 md:hidden"
        itemClassName="shrink-0"
      />
    </header>
  );
}
