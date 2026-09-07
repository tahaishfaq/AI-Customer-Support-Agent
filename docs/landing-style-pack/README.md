# AIDE Landing — Style Pack (copy-paste)

Yeh folder landing ka **poora visual system** hai: colors, dotted rails, nav squeeze, fade-ups, scroll reveals, hero orb, CTA wash, logo marquee, reviews marquee, footer tree.

## 0. Agent ko page banwane ke liye

1. **[`AGENT_BUILD_BRIEF.md`](AGENT_BUILD_BRIEF.md)** kholo  
2. **PART A** mein apna logo, naam, colors, copy bharo  
3. **PART D** wala prompt agent ko do  

Agent locked style + tumhari details se landing bana dega.

## 1. Sab se zaroori file

| File | Kya hai |
|------|---------|
| **[`landing-style.css`](landing-style.css)** | Tokens + **saari** landing CSS + animations (ek file copy karo) |
| [`LandingReveal.jsx`](LandingReveal.jsx) | React scroll-reveal (IntersectionObserver) |
| [`landing-reveal.js`](landing-reveal.js) | Same reveal — vanilla JS |
| [`LandingSectionRule.jsx`](LandingSectionRule.jsx) | Full-bleed dotted section divider |
| [`LandingScrollTop.jsx`](LandingScrollTop.jsx) | Scroll-to-top helper (repo copy) |

Live source in app: `app/globals.css` (line ~565+) · components: `components/landing/*` · page: `app/page.js`

---

## 2. Quick paste (HTML / any site)

```html
<link rel="stylesheet" href="./landing-style.css" />
<!-- Tailwind optional: many class names in JSX are Tailwind utilities.
     Pure CSS pack covers landing-* classes + keyframes.
     For full pixel match, also use Tailwind v4 OR copy utility classes as custom CSS. -->

<main class="landing-page">
  <div class="landing-stack">
    <div class="landing-rail landing-rail--start">
      <section class="landing-section">
        <h1 class="landing-display landing-fade-up">Your headline</h1>
        <p class="landing-fade-up-delay" style="color: var(--landing-muted)">
          Supporting line
        </p>
        <a class="landing-btn-ink" href="#">Get started</a>
      </section>
    </div>
    <div class="landing-section-rule" aria-hidden="true"></div>
    <div class="landing-rail landing-rail--end">…</div>
  </div>
</main>

<script type="module">
  import { initLandingReveals } from "./landing-reveal.js";
  initLandingReveals();
</script>
```

Reveal markup:

```html
<div class="landing-reveal" data-landing-reveal data-delay="60">…</div>
```

---

## 3. Design tokens (light)

| Token | Value / role |
|-------|----------------|
| `--landing-ink` | Near-black text `oklch(0.18 0.01 50)` |
| `--landing-muted` | Secondary text |
| `--landing-ground` | Page wash behind rails |
| `--landing-panel` | Soft panel |
| `--color-primary` / `--primary` | Orange accent `oklch(0.6717 0.2205 37.8105)` |
| `--landing-dot` | Dotted borders (auto from ink) |
| `--landing-ease` | `cubic-bezier(0.16, 1, 0.3, 1)` nav |
| `--landing-rail-max` | 90rem (1440px) |
| Font | **DM Sans** 400–900 |

Accent used on: CTA top hairline glow, hero orb, footer hover, cursor blink.

---

## 4. Animations checklist

| Class / keyframe | Effect |
|------------------|--------|
| `.landing-fade-up` (+ `-delay`, `-delay-2`) | Mount: opacity + 18px up · 0.52s |
| `.landing-reveal` → `--visible` | Scroll: 14px up + fade · 0.28s |
| `.landing-reveal-fade` | Fade only (sticky-safe) |
| `.landing-hero-orb-copy` / `landing-orb-morph` | Morphing radial glow · 14s loop |
| `.landing-cta-orb-a/b` + `.landing-cta-sheen` | CTA atmosphere wash |
| `.landing-logo-marquee` / `landing-marquee` | Horizontal logo strip · 38s |
| `.landing-reviews-v-marquee--up/down` | Vertical review columns · 42s |
| `.landing-nav-shell--scrolled` | Nav width squeeze + blur + radius |
| `.landing-btn-ink::before` | Orange glowing top hairline |
| `prefers-reduced-motion` | All above disabled / instant |

**JS (not CSS):** Hero typewriter in `LandingHero.jsx` (`RotatingPrompt`) — copy that component if you need the typing cursor.

---

## 5. Layout building blocks

```text
.landing-page
  └─ .landing-stack
       ├─ .landing-rail.landing-rail--start   (white, dotted L/R)
       ├─ .landing-section-rule              (full-bleed dotted line)
       ├─ .landing-rail …
       └─ .landing-rail.landing-rail--end.landing-rail--ink  (dark footer)
```

Dotted helpers: `.landing-dot-frame` · `.landing-dot-t/b/y/r` · `.landing-dot-cell*`

Typography: `.landing-display` (semibold, tight tracking)

Nav: wrap bar in `.landing-nav-shell` → add `.landing-nav-shell--scrolled` on scroll (see `LandingNav.jsx`)

---

## 6. Tailwind note

Components use **Tailwind utility classes** (`px-5`, `sm:text-5xl`, `flex`, …) plus `landing-*` CSS.

- **Option A:** Use this pack inside a Tailwind project (best match).  
- **Option B:** Copy only `landing-*` CSS + rewrite layout with your own CSS.  
- **Option C:** Copy whole `components/landing/*.jsx` + `app/page.js` into another Next/Tailwind app and link `landing-style.css` **or** keep using `app/globals.css`.

---

## 7. Repo files to mirror full page

```text
app/page.js
components/landing/LandingNav.jsx
components/landing/LandingHero.jsx        ← fade-up + orb + typewriter + marquee
components/landing/LandingFeatures.jsx
components/landing/LandingHowItWorks.jsx
components/landing/LandingReviews.jsx     ← vertical marquees
components/landing/LandingPlans.jsx       ← CTA atmosphere classes
components/landing/LandingFaq.jsx
components/landing/LandingContact.jsx
components/landing/LandingFooter.jsx
components/landing/FeatureLive*.jsx       ← feature demos
public/landing/hero-chat-bg.png           ← hero image
```

---

## 8. Change brand color

In `landing-style.css` `:root`:

```css
--primary: oklch(0.6717 0.2205 37.8105); /* orange — change this */
```

Ink/muted/ground adjust the Syncrun-like cream + dotted editorial look.
