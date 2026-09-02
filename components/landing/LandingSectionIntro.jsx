import { cn } from "@/lib/utils";
import { LandingReveal } from "@/components/landing/LandingReveal";

export function LandingSectionIntro({
  eyebrow,
  title,
  description,
  align = "center",
  eyebrowClassName,
  titleClassName,
  className,
}) {
  const alignClass =
    align === "center" ? "mx-auto max-w-2xl text-center" : "max-w-2xl";

  return (
    <div className={cn(alignClass, className)}>
      <LandingReveal>
        <p
          className={cn(
            "text-[12px] font-semibold tracking-[0.14em] uppercase",
            eyebrowClassName || "text-[var(--landing-muted)]"
          )}
        >
          {eyebrow}
        </p>
      </LandingReveal>
      <LandingReveal delay={25}>
        <h2
          className={cn(
            "landing-display mt-3 text-3xl text-[var(--landing-ink)] sm:text-4xl md:text-[2.65rem] md:leading-[1.15]",
            titleClassName
          )}
        >
          {title}
        </h2>
      </LandingReveal>
      {description ? (
        <LandingReveal delay={50}>
          <p className="mt-3 text-[15px] leading-relaxed text-[var(--landing-muted)] sm:mt-4 sm:text-base">
            {description}
          </p>
        </LandingReveal>
      ) : null}
    </div>
  );
}
