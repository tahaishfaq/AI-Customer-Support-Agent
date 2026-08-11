import { RegisterForm } from "@/components/auth/RegisterForm";

export const metadata = {
  title: "Create account — Hapy",
};

export default function RegisterPage() {
  return (
    <div className="flex h-full flex-col">
      <h1 className="font-[family-name:var(--font-display)] text-3xl font-semibold tracking-tight text-[#0f172a] sm:text-4xl">
        Create an account
      </h1>
      <p className="mt-2 text-[15px] text-[#475569]">
        Build your AI agent today
      </p>
      <div className="mt-10">
        <RegisterForm />
      </div>
    </div>
  );
}
