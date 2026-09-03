import { LandingNav } from "@/components/landing/LandingNav";
import { LandingScrollTop } from "@/components/landing/LandingScrollTop";
import { LandingHero } from "@/components/landing/LandingHero";
import { LandingFeatures } from "@/components/landing/LandingFeatures";
import { LandingHowItWorks } from "@/components/landing/LandingHowItWorks";
import { LandingReviews } from "@/components/landing/LandingReviews";
import { LandingPlans } from "@/components/landing/LandingPlans";
import { LandingFaq } from "@/components/landing/LandingFaq";
import { LandingContact } from "@/components/landing/LandingContact";
import { LandingFooter } from "@/components/landing/LandingFooter";
import { LandingSectionRule } from "@/components/landing/LandingSectionRule";

function Rail({ children, className = "" }) {
  return <div className={`landing-rail ${className}`.trim()}>{children}</div>;
}

export default function HomePage() {
  return (
    <main className="landing-page flex min-h-dvh flex-1 flex-col">
      <LandingScrollTop />
      <LandingNav />
      <div className="landing-stack">
        <Rail className="landing-rail--start">
          <LandingHero />
        </Rail>
        <LandingSectionRule />
        <Rail>
          <LandingFeatures />
        </Rail>
        <LandingSectionRule />
        <Rail>
          <LandingHowItWorks />
        </Rail>
        <LandingSectionRule />
        <Rail>
          <LandingReviews />
        </Rail>
        <LandingSectionRule />
        <Rail>
          <LandingPlans />
        </Rail>
        <LandingSectionRule />
        <Rail>
          <LandingFaq />
        </Rail>
        <LandingSectionRule />
        <Rail>
          <LandingContact />
        </Rail>
        <LandingSectionRule />
        <Rail className="landing-rail--end landing-rail--ink">
          <LandingFooter />
        </Rail>
      </div>
    </main>
  );
}
