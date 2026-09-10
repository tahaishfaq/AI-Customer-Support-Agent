import { ForgotPasswordForm } from "@/components/auth/ForgotPasswordForm";

export const metadata = {
  title: "Forgot password — AIDE",
};

export default function ForgotPasswordPage() {
  return (
    <>
      <div className="mb-7 sm:mb-8">
        <p className="auth-eyebrow">Account recovery</p>
        <h1 className="landing-display mt-3 text-[1.85rem] text-[var(--landing-ink)] sm:text-[2.15rem]">
          Forgot password
        </h1>
        <p className="mt-2 text-[14px] leading-relaxed text-[#6B665C]">
          We&apos;ll email a 6-digit code that expires in 5 minutes.
        </p>
      </div>
      <ForgotPasswordForm />
    </>
  );
}
