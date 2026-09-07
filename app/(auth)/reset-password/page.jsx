import { ResetPasswordForm } from "@/components/auth/ResetPasswordForm";

export const metadata = {
  title: "Reset password — AIDE",
};

export default async function ResetPasswordPage({ searchParams }) {
  const query = await searchParams;
  const initialEmail =
    typeof query?.email === "string" ? query.email.trim() : "";

  return (
    <>
      <div className="mb-7 sm:mb-8">
        <p className="auth-eyebrow">Account recovery</p>
        <h1 className="landing-display mt-3 text-[1.85rem] text-[var(--landing-ink)] sm:text-[2.15rem]">
          Reset password
        </h1>
        <p className="mt-2 text-[14px] leading-relaxed text-[#6B665C]">
          Enter the code from your email and choose a new password.
        </p>
      </div>
      <ResetPasswordForm initialEmail={initialEmail} />
    </>
  );
}
