import { RegisterForm } from "@/components/auth/RegisterForm";
import { getPlatformSettings } from "@/lib/services/platform-settings.service";

export const metadata = {
  title: "Create account — AIDE",
};

export default async function RegisterPage({ searchParams }) {
  const query = await searchParams;
  const presetEmail =
    typeof query?.email === "string" ? query.email.trim() : "";

  let signupsEnabled = true;
  try {
    const settings = await getPlatformSettings();
    signupsEnabled = settings.signupsEnabled !== false;
  } catch {
    signupsEnabled = true;
  }

  return (
    <>
      <div className="mb-7 sm:mb-8">
        <p className="auth-eyebrow">[ Create account ]</p>
        <h1 className="landing-display mt-3 text-[1.85rem] text-[var(--landing-ink)] sm:text-[2.15rem]">
          Start with AIDE
        </h1>
        <p className="mt-2 text-[14px] leading-relaxed text-[#6B665C]">
          Build your first grounded support agent today.
        </p>
      </div>
      <RegisterForm
        initialEmail={presetEmail}
        signupsEnabled={signupsEnabled}
      />
    </>
  );
}
