import { LandingNav } from "@/components/landing/LandingNav";
import { LandingScrollTop } from "@/components/landing/LandingScrollTop";
import { LandingHero } from "@/components/landing/LandingHero";
import { LandingFeatures } from "@/components/landing/LandingFeatures";
import { LandingHowItWorks } from "@/components/landing/LandingHowItWorks";
import { LandingReviews } from "@/components/landing/LandingReviews";
import { LandingPlans } from "@/components/landing/LandingPlans";
import { LandingFaq } from "@/components/landing/LandingFaq";
import {
  LandingCTA,
  LandingFooter,
} from "@/components/landing/LandingCTA";

export default function HomePage() {
  return (
    <main className="landing-page flex min-h-dvh flex-1 flex-col bg-white">
      <LandingScrollTop />
      <LandingNav />
      <LandingHero />
      <LandingFeatures />
      <LandingHowItWorks />
      <LandingReviews />
      <LandingPlans />
      <LandingFaq />
      <LandingCTA />
      <LandingFooter />
    </main>
  );
}
