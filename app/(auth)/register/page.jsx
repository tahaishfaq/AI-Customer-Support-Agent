import { Suspense } from "react";
import { RegisterForm } from "@/components/auth/RegisterForm";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export const metadata = {
  title: "Create account — Aide",
};

export default function RegisterPage() {
  return (
    <Card className="border-border/60 shadow-sm ring-foreground/5">
      <CardHeader className="border-b border-border/60">
        <CardTitle className="font-[family-name:var(--font-display)] text-2xl font-semibold tracking-tight sm:text-3xl">
          Create an account
        </CardTitle>
        <CardDescription className="text-[15px]">
          Build your AI agent today
        </CardDescription>
      </CardHeader>
      <CardContent className="pt-6">
        <Suspense>
          <RegisterForm />
        </Suspense>
      </CardContent>
    </Card>
  );
}
