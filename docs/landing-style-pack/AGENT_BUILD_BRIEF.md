# Agent brief — Build my landing (Aide style + my brand)

**Purpose:** Is document ko kisi AI coding agent ko do. Woh **is style system** mein landing page banaye — lekin **tumhare logo, naam, colors, copy** se.

**Style source (locked):** `docs/landing-style-pack/landing-style.css` + AIDE landing structure (`app/page.js`, `components/landing/`*).

---

# PART A — Tum fill karo (agent se pehle)

> Agent: agar yeh section empty / `TODO` ho to **build mat start karo** — pehle user se poochho.

## A1. Brand identity


| Field                         | Value (fill)                                                                                                       |
| ----------------------------- | ------------------------------------------------------------------------------------------------------------------ |
| **Product / brand name**      | Magnetic AI                                                                                                        |
| **Tagline (1 line)**          | # From intent to working software.                                                                                 |
| **One-sentence what we do**   | An AI-native IDE for turning ideas into reviewed code. Plan, build, and stay in control, in one focused workspace. |
| **Primary audience**          |                                                                                                                    |
| **Primary CTA label + URL**   | Join the Waitlist                                                                                                  |
| **Secondary CTA label + URL** | explore workflow                                                                                                   |
| **Logo file path / URL**      | '/Users/samiafzal/Desktop/IDE/Assets /magnetic-4x4-logo-pack'                                                      |
| **Logo (on dark footer)**     | '/Users/samiafzal/Desktop/IDE/Assets /magnetic-4x4-logo-pack'                                                      |
| **Favicon**                   | TODO                                                                                                               |
| **Hero image / product shot** | '/Users/samiafzal/Desktop/IDE/Assets /Hero Section/ChatGPT Image Sep 5, 2026, 05_28_29 PM.png'                     |
| **Contact email**             | Magnetic.ai@gmail.com                                                                                              |
| **Social links**              | TODO                                                                                                               |




## A2. Colors (optional override)

Default = Aide orange editorial. Override only if you have a brand palette:


| Token                     | Default                        | Your value   |
| ------------------------- | ------------------------------ | ------------ |
| Accent `--primary`        | `oklch(0.6717 0.2205 37.8105)` | TODO or keep |
| Ink `--landing-ink`       | `oklch(0.18 0.01 50)`          | TODO or keep |
| Muted `--landing-muted`   | `oklch(0.48 0.01 50)`          | TODO or keep |
| Ground `--landing-ground` | `oklch(0.985 0.004 70)`        | TODO or keep |


**Rule:** Sirf accent change karna safe hai. Ink/ground change karo to dotted borders + contrast re-check karo.

## A3. Content blocks (fill or mark “write for me”)


| Section                      | Content                                                                                                            |
| ---------------------------- | ------------------------------------------------------------------------------------------------------------------ |
| **Hero eyebrow**             | **One workspace for your next move**                                                                               |
| **Hero H1**                  | # From intent to working software.                                                                                 |
| **Hero sub**                 | An AI-native IDE for turning ideas into reviewed code. Plan, build, and stay in control, in one focused workspace. |
| **Logo strip names**         | TODO 6–8 partner/client names OR “hide section”                                                                    |
| **Workflow**                 | TODO                                                                                                               |
| **How it works (3–4 steps)** | TODO                                                                                                               |
| **Features**                 | TODO                                                                                                               |
| **Plans**                    | TODO                                                                                                               |
| Contact / Waitlsy form       | TODO                                                                                                               |
| **Footer columns**           | TODO                                                                                                               |




## A4. Tech target


| Field                        | Value                                                           |
| ---------------------------- | --------------------------------------------------------------- |
| **Stack**                    | TODO e.g. `Next.js App Router + Tailwind v4` / `plain HTML+CSS` |
| **Output path**              | TODO e.g. `app/page.js` + `components/landing/`*                |
| **Use existing style pack?** | YES — import / copy `docs/landing-style-pack/landing-style.css` |
| **Language**                 | TODO `en` / `ur` / bilingual                                    |


---



# PART B — Agent system instructions (copy as system/user prompt)

Paste this to the agent **after** Part A is filled:

```text
You are implementing a marketing landing page.

LOCKED VISUAL SYSTEM (do not invent a new aesthetic):
- Use the Aide “Syncrun-inspired” editorial landing: cream/white rails, dotted borders,
  DM Sans, near-black ink, orange accent hairline on primary CTAs.
- CSS: use docs/landing-style-pack/landing-style.css (or equivalent classes already in
  app/globals.css under .landing-*). Do NOT switch to purple gradients, Inter defaults,
  glassmorphism stacks, or generic AI SaaS templates.
- Structure MUST follow: .landing-page → .landing-stack → alternating
  .landing-rail + .landing-section-rule → final .landing-rail--end.landing-rail--ink footer.
- Brand: use ONLY the logo, name, colors, and copy from PART A of the brief.
  Never invent a different product name.

CODE STYLE:
- Prefer existing components under components/landing/ if in this repo; otherwise mirror them.
- queryFn/API not needed for static marketing unless contact form is specified.
- Client components only where needed (nav scroll, reveal, marquees, typewriter).
- Respect prefers-reduced-motion (disable loops / instant reveals).
- Mobile-first; hero first viewport = brand + one headline + one sub + CTA group + one visual.
- No cards in the hero. No floating badges on hero media.
- Primary buttons: class landing-btn-ink (black + orange top glow).
- Display headlines: class landing-display.
- Scroll sections wrap in LandingReveal (or data-landing-reveal).

ANIMATIONS REQUIRED (from style pack):
1. landing-fade-up / -delay / -delay-2 on hero load
2. LandingReveal on each major section
3. Hero morph orb (.landing-hero-orb-copy) behind hero
4. Optional: logo marquee, reviews vertical marquee, CTA atmosphere orbs
5. Nav: .landing-nav-shell → add --scrolled on scroll (squeeze + blur)

DELIVERABLES:
1. Working landing page at the Output path
2. Logo in nav + footer (dark footer uses light logo if provided)
3. Tokens overridden only where PART A specifies
4. Short note of files touched

ACCEPTANCE:
- First viewport reads as one composition with brand logo visible
- Dotted rail layout intact
- Animations run; reduced-motion safe
- All PART A links/CTAs correct
- No placeholder “Lorem” if PART A provided real copy
```

---



# PART C — Locked design system (agent must follow)



## C1. Visual signature

- **Look:** Editorial SaaS — white content rails on soft cream ground, **1px dotted** ink borders.
- **Font:** DM Sans (400–900). Display = semibold, tracking `-0.02em`.
- **Accent:** Orange primary — CTAs, orb, footer hover, typewriter caret — **not** purple.
- **Radius:** Modest (`0.5rem`); scrolled nav uses `--radius-md`.
- **Max rail:** 1440px (`90rem`).



## C2. Page skeleton (ASCII)

```text
┌─ fixed LandingNav (full bleed → squeezes when scrolled) ─┐
│  [Logo]  links…                    [Secondary] [CTA ink] │
└──────────────────────────────────────────────────────────┘
┌ landing-rail--start (white, dotted L/R) ─────────────────┐
│  HERO: eyebrow · H1 · sub · CTAs · orb glow · showcase   │
│  logo marquee                                            │
└──────────────────────────────────────────────────────────┘
═ landing-section-rule (full-bleed dotted) ════════════════
┌ landing-rail ────────────────────────────────────────────┐
│  FEATURES grid (landing-dot-frame cells)                 │
└──────────────────────────────────────────────────────────┘
═ rule ════════════════════════════════════════════════════
┌ HOW IT WORKS ────────────────────────────────────────────┐
═ rule ════════════════════════════════════════════════════
┌ REVIEWS (optional vertical marquees) ────────────────────┐
═ rule ════════════════════════════════════════════════════
┌ PLANS / CTA atmosphere ──────────────────────────────────┐
═ rule ════════════════════════════════════════════════════
┌ FAQ ═════════════════════════════════════════════════════
═ rule ════════════════════════════════════════════════════
┌ CONTACT ─────────────────────────────────────────────────┐
═ rule ════════════════════════════════════════════════════
┌ landing-rail--end landing-rail--ink (dark footer) ───────┐
│  logo-light · tree links · legal                         │
└──────────────────────────────────────────────────────────┘
```



## C3. Class cheat-sheet


| Use          | Class                                                                                    |
| ------------ | ---------------------------------------------------------------------------------------- |
| Page root    | `landing-page`                                                                           |
| Column stack | `landing-stack`                                                                          |
| White frame  | `landing-rail` (+ `--start` / `--end` / `--ink`)                                         |
| Section      | `landing-section`                                                                        |
| Divider      | `landing-section-rule`                                                                   |
| Title        | `landing-display`                                                                        |
| Primary btn  | `landing-btn-ink`                                                                        |
| Dotted box   | `landing-dot-frame`                                                                      |
| Load anim    | `landing-fade-up`, `landing-fade-up-delay`, `landing-fade-up-delay-2`                    |
| Scroll anim  | `landing-reveal` + `--visible` (via LandingReveal)                                       |
| Hero glow    | `landing-hero-stage` + `landing-hero-orb landing-hero-orb-copy`                          |
| CTA wash     | `landing-cta-atmosphere`, `landing-cta-base`, `landing-cta-orb-a/b`, `landing-cta-sheen` |
| Logo strip   | `landing-logo-marquee`                                                                   |
| Reviews      | `landing-reviews-v-marquee--up/down`                                                     |




## C4. Code style rules

1. **Reuse** `landing-style.css` / existing `landing-`* — don’t rewrite keyframes.
2. **Tailwind OK** for spacing/layout utilities alongside `landing-`*.
3. **No new design system** mid-build (no shadcn card grid as hero).
4. **Logo:** `<img>` or next/image with explicit width/height; never replace brand mark with generic icon-only mark unless PART A says so.
5. **Copy:** active voice, sentence case, no “revolutionary / seamless / leverage” filler.
6. **Contact form:** only if PART A asks; otherwise mailto / link.
7. **Accessibility:** focus rings, `aria-hidden` on decorative orbs, alt text on logo (“{Brand}”).
8. **Files:** keep landing pieces split (Nav, Hero, Features, …) like current repo.



## C5. Animation implementation notes


| Motion         | How                                                                     |
| -------------- | ----------------------------------------------------------------------- |
| Hero entrance  | Static classes on mount                                                 |
| Section enter  | `LandingReveal` / `initLandingReveals()` once per section               |
| Nav scroll     | `scroll` listener → toggle `landing-nav-shell--scrolled`                |
| Typewriter     | Optional — port from `LandingHero.jsx` RotatingPrompt; use PART A lines |
| Reduced motion | CSS media queries already in pack; JS must short-circuit                |


---



# PART D — One-shot prompt (user → agent)

User is message mein yeh paste kare (Part A fill karke):

```text
Build my landing page using this brief:
/Users/samiafzal/Desktop/Hapy Ai support agent/AI-Customer-Support-Agent/docs/landing-style-pack/AGENT_BUILD_BRIEF.md

CSS pack:
/Users/samiafzal/Desktop/Hapy Ai support agent/AI-Customer-Support-Agent/docs/landing-style-pack/landing-style.css

My brand (PART A):
- Name: …
- Tagline: …
- Logo: …
- Accent color: … (or keep default)
- Hero H1 / sub: …
- Primary CTA: … → …
- Sections to include: Hero, Features, How it works, Reviews, Plans, FAQ, Contact, Footer
- Stack / output path: …

Follow PART B–C exactly. Do not redesign the visual system — only rebrand with my details.
Use absolute paths listed at the end of the brief for all source files.
```

---



# PART E — Agent done checklist

- [ ] Part A values appear (name, logo, CTAs)
- [ ] `landing-style.css` or globals `landing-*` linked
- [ ] Rail + section-rule structure
- [ ] Hero animations + at least one scroll reveal
- [ ] Nav scroll state works
- [ ] Footer dark + logo
- [ ] Mobile OK (375px)
- [ ] `prefers-reduced-motion` OK
- [ ] No purple/Inter generic SaaS look

---

**Related files — local absolute paths (this machine)**

Base: `/Users/samiafzal/Desktop/Hapy Ai support agent/AI-Customer-Support-Agent`

### Style pack (copy-paste / agent brief)

| Role | Local path |
|------|------------|
| This brief | `/Users/samiafzal/Desktop/Hapy Ai support agent/AI-Customer-Support-Agent/docs/landing-style-pack/AGENT_BUILD_BRIEF.md` |
| Style pack README | `/Users/samiafzal/Desktop/Hapy Ai support agent/AI-Customer-Support-Agent/docs/landing-style-pack/README.md` |
| Portable CSS + animations | `/Users/samiafzal/Desktop/Hapy Ai support agent/AI-Customer-Support-Agent/docs/landing-style-pack/landing-style.css` |
| React reveal | `/Users/samiafzal/Desktop/Hapy Ai support agent/AI-Customer-Support-Agent/docs/landing-style-pack/LandingReveal.jsx` |
| Vanilla reveal | `/Users/samiafzal/Desktop/Hapy Ai support agent/AI-Customer-Support-Agent/docs/landing-style-pack/landing-reveal.js` |
| Section rule (pack) | `/Users/samiafzal/Desktop/Hapy Ai support agent/AI-Customer-Support-Agent/docs/landing-style-pack/LandingSectionRule.jsx` |
| Scroll top (pack) | `/Users/samiafzal/Desktop/Hapy Ai support agent/AI-Customer-Support-Agent/docs/landing-style-pack/LandingScrollTop.jsx` |

### Live app — page + globals

| Role | Local path |
|------|------------|
| Home / landing page | `/Users/samiafzal/Desktop/Hapy Ai support agent/AI-Customer-Support-Agent/app/page.js` |
| Global CSS (includes `landing-*`) | `/Users/samiafzal/Desktop/Hapy Ai support agent/AI-Customer-Support-Agent/app/globals.css` |
| Root layout (DM Sans font) | `/Users/samiafzal/Desktop/Hapy Ai support agent/AI-Customer-Support-Agent/app/layout.js` |

### Live app — `components/landing/`

| Role | Local path |
|------|------------|
| Nav | `/Users/samiafzal/Desktop/Hapy Ai support agent/AI-Customer-Support-Agent/components/landing/LandingNav.jsx` |
| Hero (+ typewriter, orb, logo marquee) | `/Users/samiafzal/Desktop/Hapy Ai support agent/AI-Customer-Support-Agent/components/landing/LandingHero.jsx` |
| Features | `/Users/samiafzal/Desktop/Hapy Ai support agent/AI-Customer-Support-Agent/components/landing/LandingFeatures.jsx` |
| How it works | `/Users/samiafzal/Desktop/Hapy Ai support agent/AI-Customer-Support-Agent/components/landing/LandingHowItWorks.jsx` |
| Reviews | `/Users/samiafzal/Desktop/Hapy Ai support agent/AI-Customer-Support-Agent/components/landing/LandingReviews.jsx` |
| Plans / CTA | `/Users/samiafzal/Desktop/Hapy Ai support agent/AI-Customer-Support-Agent/components/landing/LandingPlans.jsx` |
| FAQ | `/Users/samiafzal/Desktop/Hapy Ai support agent/AI-Customer-Support-Agent/components/landing/LandingFaq.jsx` |
| Contact | `/Users/samiafzal/Desktop/Hapy Ai support agent/AI-Customer-Support-Agent/components/landing/LandingContact.jsx` |
| Footer | `/Users/samiafzal/Desktop/Hapy Ai support agent/AI-Customer-Support-Agent/components/landing/LandingFooter.jsx` |
| Reveal | `/Users/samiafzal/Desktop/Hapy Ai support agent/AI-Customer-Support-Agent/components/landing/LandingReveal.jsx` |
| Section rule | `/Users/samiafzal/Desktop/Hapy Ai support agent/AI-Customer-Support-Agent/components/landing/LandingSectionRule.jsx` |
| Section intro | `/Users/samiafzal/Desktop/Hapy Ai support agent/AI-Customer-Support-Agent/components/landing/LandingSectionIntro.jsx` |
| Scroll top | `/Users/samiafzal/Desktop/Hapy Ai support agent/AI-Customer-Support-Agent/components/landing/LandingScrollTop.jsx` |
| Feature live chat demo | `/Users/samiafzal/Desktop/Hapy Ai support agent/AI-Customer-Support-Agent/components/landing/FeatureLiveChat.jsx` |
| Feature live actions demo | `/Users/samiafzal/Desktop/Hapy Ai support agent/AI-Customer-Support-Agent/components/landing/FeatureLiveActions.jsx` |
| Feature live insights demo | `/Users/samiafzal/Desktop/Hapy Ai support agent/AI-Customer-Support-Agent/components/landing/FeatureLiveInsights.jsx` |

### Assets (logo / hero)

| Role | Local path |
|------|------------|
| Hero image | `/Users/samiafzal/Desktop/Hapy Ai support agent/AI-Customer-Support-Agent/public/landing/hero-chat-bg.png` |
| Logo PNG | `/Users/samiafzal/Desktop/Hapy Ai support agent/AI-Customer-Support-Agent/public/brand/aide-logo.png` |
| Logo SVG | `/Users/samiafzal/Desktop/Hapy Ai support agent/AI-Customer-Support-Agent/public/brand/aide-logo.svg` |
| Logo current SVG | `/Users/samiafzal/Desktop/Hapy Ai support agent/AI-Customer-Support-Agent/public/brand/aide-logo-current.svg` |
| Logo white PNG (footer) | `/Users/samiafzal/Desktop/Hapy Ai support agent/AI-Customer-Support-Agent/public/brand/aide-logo-white.png` |
| Logo white SVG (footer) | `/Users/samiafzal/Desktop/Hapy Ai support agent/AI-Customer-Support-Agent/public/brand/aide-logo-white.svg` |
| Logo source PNG | `/Users/samiafzal/Desktop/Hapy Ai support agent/AI-Customer-Support-Agent/public/brand/aide-logo-source.png` |
