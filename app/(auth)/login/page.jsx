import { Suspense } from "react";
import { LoginForm } from "@/components/auth/LoginForm";

export const metadata = {
  title: "Sign in — Aide",
};

export default function LoginPage() {
  return (
    <div className="w-full rounded-[1.5rem] border border-black/[0.06] bg-white/95 p-6 shadow-[0_28px_70px_-32px_rgba(20,16,12,0.35)] backdrop-blur-sm sm:p-8">
      <div className="mb-6 text-center sm:mb-8">
        <h1 className="landing-display text-[1.75rem] text-[var(--landing-ink)] sm:text-[2rem]">
          Welcome back
        </h1>
        <p className="mt-2 text-[14px] text-[var(--landing-muted)]">
          Sign in to your AI support workspace
        </p>
      </div>
      <Suspense>
        <LoginForm />
      </Suspense>
    </div>
  );
}
