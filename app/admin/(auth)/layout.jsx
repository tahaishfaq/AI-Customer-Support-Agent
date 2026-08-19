import { AuthVisualPanel } from "@/components/auth/AuthVisualPanel";
import Link from "next/link";

export default function AdminAuthLayout({ children }) {
  return (
    <div className="grid min-h-screen bg-white lg:grid-cols-2">
      <div className="flex min-h-screen flex-col bg-white px-6 py-8 sm:px-10">
        <Link
          href="/admin/login"
          className="mb-8 font-[family-name:var(--font-display)] text-lg font-semibold text-[var(--color-primary)] lg:mb-12"
        >
          Hapy Admin
        </Link>
        <div className="mx-auto flex w-full max-w-[400px] flex-1 flex-col justify-center pb-10">
          <div className="min-h-[520px]">{children}</div>
        </div>
      </div>
      <AuthVisualPanel />
    </div>
  );
}
