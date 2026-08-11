"use client";

import Link from "next/link";
import { useAuthStore } from "@/store/auth-store";
import { buttonVariants } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { cn } from "@/lib/utils";

export default function DashboardPage() {
  const user = useAuthStore((s) => s.user);
  const loading = useAuthStore((s) => s.loading);

  return (
    <main className="mx-auto w-full max-w-3xl px-6 py-12">
      <h1 className="font-[family-name:var(--font-display)] text-3xl font-semibold tracking-tight text-[var(--color-text)]">
        {loading
          ? "Loading…"
          : `Welcome${user?.name ? `, ${user.name}` : ""}`}
      </h1>
      <p className="mt-2 text-[var(--color-text-secondary)]">
        Your AI support workspace is ready. Agents and analytics come next.
      </p>

      <Card className="mt-10 border-[var(--color-border)] shadow-sm">
        <CardHeader>
          <CardTitle className="text-lg">What&apos;s next</CardTitle>
          <CardDescription>
            Phase 2 will add agent creation, knowledge, and chat.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-3 sm:flex-row">
          <Link href="/" className={cn(buttonVariants({ variant: "outline" }))}>
            Back to landing
          </Link>
        </CardContent>
      </Card>
    </main>
  );
}
