import { LandingHero } from "@/components/landing/LandingHero";
import { LandingHowItWorks } from "@/components/landing/LandingHowItWorks";
import Link from "next/link";

export default function HomePage() {
  return (
    <main className="flex flex-1 flex-col">
      <LandingHero />
      <LandingHowItWorks />
      <footer className="border-t border-[var(--color-border)] px-6 py-8 text-center text-sm text-[var(--color-muted)]">
        <span>Hapy — AI Customer Support & Insights</span>
        <span className="mx-2">·</span>
        <Link href="/login" className="text-[var(--color-primary)] hover:underline">
          Sign in
        </Link>
      </footer>
    </main>
  );
}
