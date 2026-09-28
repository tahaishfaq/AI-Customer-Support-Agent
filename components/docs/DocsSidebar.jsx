"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

export function DocsSidebar({ nav = [] }) {
  const pathname = usePathname() || "/docs";
  return (
    <nav aria-label="Aide docs" className="flex flex-col gap-0.5">
      {nav.map((item) => {
        const active =
          item.href === pathname ||
          (item.href !== "/docs" && pathname.startsWith(`${item.href}/`));
        return (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              "rounded-md px-2.5 py-1.5 text-sm transition-colors",
              active
                ? "bg-primary/10 font-semibold text-primary"
                : "text-muted-foreground hover:bg-muted hover:text-foreground"
            )}
          >
            {item.title}
          </Link>
        );
      })}
    </nav>
  );
}
