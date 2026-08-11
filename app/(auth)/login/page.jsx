import { Suspense } from "react";
import { AuthFlow } from "@/components/auth/AuthFlow";

export const metadata = {
  title: "Sign in — Hapy",
};

export default function LoginPage() {
  return (
    <Suspense fallback={<div className="text-sm text-[#64748b]">Loading…</div>}>
      <AuthFlow initialMode="login" />
    </Suspense>
  );
}
