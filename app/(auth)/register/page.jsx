import { Suspense } from "react";
import { RegisterForm } from "@/components/auth/RegisterForm";

export const metadata = {
  title: "Create account — Aide",
};

export default function RegisterPage() {
  return (
    <div className="w-full rounded-[1.5rem] border border-black/[0.06] bg-white/95 p-6 shadow-[0_28px_70px_-32px_rgba(20,16,12,0.35)] backdrop-blur-sm sm:p-8">
      <div className="mb-6 text-center sm:mb-8">
        <h1 className="landing-display text-[1.75rem] text-[var(--landing-ink)] sm:text-[2rem]">
          Create an account
        </h1>
        <p className="mt-2 text-[14px] text-[var(--landing-muted)]">
          Build your AI agent today
        </p>
      </div>
      <Suspense>
        <RegisterForm />
      </Suspense>
    </div>
  );
}
