import { LandingNav } from "@/components/landing/LandingNav";
import { LandingHero } from "@/components/landing/LandingHero";
import { LandingHowItWorks } from "@/components/landing/LandingHowItWorks";
import { LandingFeatures } from "@/components/landing/LandingFeatures";
import {
  LandingCTA,
  LandingFooter,
} from "@/components/landing/LandingCTA";

export default function HomePage() {
  return (
    <main className="flex min-h-dvh flex-1 flex-col bg-[var(--color-bg)]">
      <LandingNav />
      <LandingHero />
      <LandingHowItWorks />
      <LandingFeatures />
      <LandingCTA />
      <LandingFooter />
    </main>
  );
}
