import { VerifyEmailClient } from "@/components/auth/VerifyEmailClient";

export const metadata = {
  title: "Verify email — AIDE",
};

export default async function VerifyEmailPage({ searchParams }) {
  const query = await searchParams;
  const token = typeof query?.token === "string" ? query.token.trim() : "";

  return (
    <>
      <div className="mb-7 sm:mb-8">
        <p className="auth-eyebrow">Account</p>
        <h1 className="landing-display mt-3 text-[1.85rem] text-[#1A1814] sm:text-[2.15rem]">
          Verify email
        </h1>
        <p className="mt-2 text-[14px] leading-relaxed text-[#6B665C]">
          Confirm your address to finish setting up AIDE.
        </p>
      </div>
      <VerifyEmailClient token={token} />
    </>
  );
}
