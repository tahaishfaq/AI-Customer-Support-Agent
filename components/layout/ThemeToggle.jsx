"use client";

import { Moon, Sun } from "lucide-react";
import { useTheme } from "@/components/theme/ThemeProvider";
import { useSession } from "next-auth/react";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

/** Light default; toggles optional dark for Desk / Studio / app shell. */
export function ThemeToggle({ className }) {
  const { theme, setTheme } = useTheme();
  const { status } = useSession();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const dark = mounted && theme === "dark";

  async function persistTheme(next) {
    setTheme(next);
    if (status !== "authenticated") return;
    try {
      await fetch("/api/user/theme", {
        method: "PATCH",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ theme: next }),
      });
    } catch {
      // Local theme already applied; sync can retry on next load.
    }
  }

  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            className={className}
            aria-label={dark ? "Switch to light mode" : "Switch to dark mode"}
            onClick={() => persistTheme(dark ? "light" : "dark")}
          />
        }
      >
        {dark ? <Sun /> : <Moon />}
      </TooltipTrigger>
      <TooltipContent>
        {dark ? "Light mode" : "Dark mode"}
      </TooltipContent>
    </Tooltip>
  );
}
