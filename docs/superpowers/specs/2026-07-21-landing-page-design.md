# Landing Page Design — Invoice Reader

**Date:** 2026-07-21  
**Status:** Approved for implementation

## Goal

Replace `/` redirect with a cinematic marketing landing for Invoice Reader. Primary CTA → `/login`. Bilingual EN (default) + VI toggle.

## Decisions

| Item | Choice |
|------|--------|
| Visual direction | Cinematic Product (dark, Lenis + GSAP pin/scrub) |
| Primary CTA | `/login` (label: Log in / Đăng nhập) |
| Language | EN default + VI toggle (client dictionary) |
| Structure | Full story (7 blocks) |
| Route | Approach 1: landing at `/` |
| Accent | Lime `#E8FF47` on near-black |
| Magic UI | 1 Marquee (trust) + 1 BorderBeam (final CTA) |

## Architecture

- Marketing page at `src/app/page.tsx` (no dashboard chrome)
- Components under `src/components/landing/`
- Lenis only on landing; GSAP via `useGSAP` + ScrollTrigger; `gsap.matchMedia` for reduced motion
- i18n: lightweight `LandingI18nProvider` + `dictionary.ts` (no next-intl)
- Dashboard / login / signup unchanged

## Section map

1. Nav — brand, EN/VI, Log in  
2. Hero — asymmetric split + product visual + one CTA  
3. Trust — logo marquee (Magic UI, max one)  
4. How it works — sticky stack ×3 (email → extract → dashboard)  
5. Features — horizontal pan (GSAP pin)  
6. Testimonial — one quote  
7. Final CTA + Footer — BorderBeam → Log in  

## Visual system

- Theme lock: dark for entire landing  
- Type: Outfit (display/body) + existing JetBrains Mono for numbers; landing does not switch global Inter for dashboard  
- Radius: pill CTAs, ~12px media frames  
- Copy: concrete verbs; zero em-dashes; max 1 eyebrow per 3 sections  

## Out of scope

- Signup as primary CTA  
- Full next-intl  
- Particles / multi-marquee / purple AI aesthetic  
