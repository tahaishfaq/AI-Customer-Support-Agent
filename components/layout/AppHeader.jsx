"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { Button } from "@/components/ui/button";

export function AppHeader() {
  const router = useRouter();
  const { user, logout, loading } = useAuth();

  async function handleLogout() {
    await logout();
    router.push("/");
    router.refresh();
  }

  return (
    <header className="flex items-center justify-between border-b border-[var(--color-border)] bg-[var(--color-surface)] px-6 py-4">
      <Link
        href="/dashboard"
        className="font-[family-name:var(--font-display)] text-lg font-semibold text-[var(--color-primary)]"
      >
        Hapy
      </Link>
      <div className="flex items-center gap-4">
        {!loading && user ? (
          <span className="hidden text-sm text-[var(--color-text-secondary)] sm:inline">
            {user.name}
          </span>
        ) : null}
        <Button variant="outline" size="sm" onClick={handleLogout}>
          Log out
        </Button>
      </div>
    </header>
  );
}
