import { LoginForm } from "@/components/auth/LoginForm";

export const metadata = {
  title: "Sign in — AIDE",
};

export default async function LoginPage({ searchParams }) {
  const query = await searchParams;
  const sessionExpired = query?.session === "expired";
  const suspended = query?.suspended === "1";
  const next = typeof query?.next === "string" ? query.next : "";

  return (
    <>
      <div className="mb-7 sm:mb-8">
        <p className="auth-eyebrow">[ Sign in ]</p>
        <h1 className="landing-display mt-3 text-[1.85rem] text-[var(--landing-ink)] sm:text-[2.15rem]">
          Welcome back
        </h1>
        <p className="mt-2 text-[14px] leading-relaxed text-[#6B665C]">
          Sign in to your AI support workspace.
        </p>
      </div>
      <LoginForm
        sessionExpired={sessionExpired}
        suspended={suspended}
        next={next}
      />
    </>
  );
}
