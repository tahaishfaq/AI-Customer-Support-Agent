import { redirect } from "next/navigation";

export const metadata = {
  title: "Create account — Hapy",
};

export default function RegisterPage() {
  redirect("/login?mode=register");
}
