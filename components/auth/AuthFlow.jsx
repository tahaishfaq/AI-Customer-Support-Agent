"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { LoginForm } from "@/components/auth/LoginForm";
import { RegisterForm } from "@/components/auth/RegisterForm";

export function AuthFlow({ initialMode = "login" }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [mode, setMode] = useState(initialMode);

  useEffect(() => {
    if (pathname === "/register" || searchParams.get("mode") === "register") {
      setMode("register");
    } else {
      setMode("login");
    }
  }, [pathname, searchParams]);

  function switchMode(next) {
    setMode(next);
    if (next === "register") {
      router.replace("/login?mode=register", { scroll: false });
    } else {
      router.replace("/login", { scroll: false });
    }
  }

  const isRegister = mode === "register";

  return (
    <div className="flex h-full flex-col">
      <h1 className="font-[family-name:var(--font-display)] text-3xl font-semibold tracking-tight text-[#0f172a] sm:text-4xl">
        {isRegister ? "Create an account" : "Welcome back"}
      </h1>
      <p className="mt-2 text-[15px] text-[#475569]">
        {isRegister
          ? "Build your AI agent today"
          : "Sign in to your AI support workspace"}
      </p>
      <div className="mt-10">
        {isRegister ? (
          <RegisterForm onSwitchToLogin={() => switchMode("login")} />
        ) : (
          <LoginForm onSwitchToRegister={() => switchMode("register")} />
        )}
      </div>
    </div>
  );
}
