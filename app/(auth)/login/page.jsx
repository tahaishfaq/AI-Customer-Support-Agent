import { Suspense } from "react";
import { LoginForm } from "@/components/auth/LoginForm";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export const metadata = {
  title: "Sign in — Aide",
};

export default function LoginPage() {
  return (
    <Card className="border-border/60 shadow-sm ring-foreground/5">
      <CardHeader className="border-b border-border/60">
        <CardTitle className="font-[family-name:var(--font-display)] text-2xl font-semibold tracking-tight sm:text-3xl">
          Welcome back
        </CardTitle>
        <CardDescription className="text-[15px]">
          Sign in to your AI support workspace
        </CardDescription>
      </CardHeader>
      <CardContent className="pt-6">
        <Suspense>
          <LoginForm />
        </Suspense>
      </CardContent>
    </Card>
  );
}
