"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { AdminSidebar } from "@/components/admin/AdminSidebar";
import { AdminTopbar } from "@/components/admin/AdminTopbar";

export function AdminShell({ children }) {
  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    setMenuOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!menuOpen) return undefined;
    const onKey = (event) => {
      if (event.key === "Escape") setMenuOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [menuOpen]);

  return (
    <div className="flex h-dvh max-h-dvh overflow-hidden bg-[var(--color-bg)]">
      <aside className="hidden h-full w-[248px] shrink-0 overflow-hidden border-r border-[var(--color-border)] bg-[var(--color-surface)] md:block">
        <AdminSidebar />
      </aside>

      {menuOpen ? (
        <div className="fixed inset-0 z-50 md:hidden">
          <button
            type="button"
            className="absolute inset-0 bg-black/30"
            aria-label="Close menu"
            onClick={() => setMenuOpen(false)}
          />
          <aside className="relative h-full w-[248px] overflow-hidden border-r border-[var(--color-border)] bg-[var(--color-surface)]">
            <AdminSidebar onNavigate={() => setMenuOpen(false)} />
          </aside>
        </div>
      ) : null}

      <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
        <AdminTopbar onMenuClick={() => setMenuOpen(true)} />
        <div
          key={pathname}
          className="animate-page-in flex min-h-0 flex-1 flex-col overflow-hidden"
        >
          {children}
        </div>
      </div>
    </div>
  );
}
