import Link from "next/link";

export function NotFoundView() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-white px-6 text-center">
      <p className="text-sm font-medium text-[var(--color-muted)]">404</p>
      <h1 className="mt-2 font-[family-name:var(--font-display)] text-2xl font-semibold text-[#0f172a]">
        Page not found
      </h1>
      <p className="mt-2 max-w-sm text-sm text-[#475569]">
        This page does not exist or you do not have access to it.
      </p>
      <Link
        href="/"
        className="mt-6 text-sm font-medium text-[var(--color-primary)] underline underline-offset-2"
      >
        Go home
      </Link>
    </div>
  );
}
