import { Suspense } from "react";
import { LoginForm } from "@/components/auth/LoginForm";

export const metadata = {
  title: "Sign in — Hapy",
};

export default function LoginPage() {
  return (
    <div className="flex h-full flex-col">
      <h1 className="font-[family-name:var(--font-display)] text-3xl font-semibold tracking-tight text-[#0f172a] sm:text-4xl">
        Welcome back
      </h1>
      <p className="mt-2 text-[15px] text-[#475569]">
        Sign in to your AI support workspace
      </p>
      <div className="mt-10">
        <Suspense>
          <LoginForm />
        </Suspense>
      </div>
    </div>
  );
}
